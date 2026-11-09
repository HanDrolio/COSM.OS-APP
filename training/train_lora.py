#!/usr/bin/env python3
"""Train a PEFT LoRA adapter on curated prompt/completion examples using CUDA."""
import argparse
import json
from pathlib import Path
BASE = "HuggingFaceTB/SmolLM2-1.7B-Instruct"
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dataset", default=str(Path(__file__).resolve().parent / "data/train.jsonl"))
    p.add_argument("--output", default=str(Path(__file__).resolve().parent / "outputs/cosmos-lora"))
    p.add_argument("--base", default=BASE)
    p.add_argument("--epochs", type=float, default=2)
    p.add_argument("--learning-rate", type=float, default=0.0002)
    p.add_argument("--rank", type=int, default=16)
    p.add_argument("--batch-size", type=int, default=1)
    p.add_argument("--grad-accum", type=int, default=8)
    p.add_argument("--max-length", type=int, default=768)
    a = p.parse_args()
    import torch
    if not torch.cuda.is_available():
        raise SystemExit("No CUDA GPU. Train on a suitable GPU workstation; deploy GGUF on the ThinkCentre.")
    from datasets import Dataset
    from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments
    from peft import LoraConfig, get_peft_model, TaskType
    src = Path(a.dataset)
    if not src.exists():
        raise SystemExit("Missing supervised dataset: " + str(src))
    rows = [json.loads(line) for line in src.read_text(encoding="utf-8").splitlines() if line.strip()]
    examples = [(str(v.get("prompt", "")).strip(), str(v.get("completion", "")).strip()) for v in rows]
    examples = [(x, y) for x, y in examples if x and y]
    if len(examples) < 10:
        raise SystemExit("At least 10 reviewed prompt/completion pairs required. More high-quality examples recommended.")
    tok = AutoTokenizer.from_pretrained(a.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    def encode(pair):
        question, answer = pair
        prefix = tok.apply_chat_template([{"role": "user", "content": question}], tokenize=False, add_generation_prompt=True)
        full_ids = tok(prefix + answer + tok.eos_token, truncation=True, max_length=a.max_length, add_special_tokens=False)["input_ids"]
        prefix_ids = tok(prefix, add_special_tokens=False)["input_ids"]
        mask = min(len(prefix_ids), len(full_ids))
        return {"input_ids": full_ids, "attention_mask": [1] * len(full_ids), "labels": [-100] * mask + full_ids[mask:]}
    encoded = [encode(row) for row in examples]
    encoded = [row for row in encoded if any(v != -100 for v in row["labels"])]
    if not encoded:
        raise SystemExit("All completions truncated. Raise max-length or shorten prompts.")
    def collate(batch):
        end = max(len(row["input_ids"]) for row in batch)
        ids, masks, labels = [], [], []
        for row in batch:
            pad = end - len(row["input_ids"])
            ids.append(row["input_ids"] + [tok.pad_token_id] * pad)
            masks.append(row["attention_mask"] + [0] * pad)
            labels.append(row["labels"] + [-100] * pad)
        return {"input_ids": torch.tensor(ids), "attention_mask": torch.tensor(masks), "labels": torch.tensor(labels)}
    model = AutoModelForCausalLM.from_pretrained(a.base, torch_dtype=torch.float16)
    model.config.use_cache = False
    model = get_peft_model(model, LoraConfig(task_type=TaskType.CAUSAL_LM, r=a.rank, lora_alpha=a.rank * 2, lora_dropout=0.05, target_modules=["q_proj", "k_proj", "v_proj", "o_proj"]))
    model.print_trainable_parameters()
    args = TrainingArguments(output_dir=a.output, per_device_train_batch_size=a.batch_size, gradient_accumulation_steps=a.grad_accum,
        num_train_epochs=a.epochs, learning_rate=a.learning_rate, logging_steps=5, save_strategy="epoch", save_total_limit=2,
        fp16=True, gradient_checkpointing=True, report_to="none", remove_unused_columns=False, optim="adamw_torch")
    trainer = Trainer(model=model, args=args, train_dataset=Dataset.from_list(encoded), data_collator=collate)
    trainer.train()
    trainer.save_model(a.output)
    tok.save_pretrained(a.output)
    print("LoRA adapter saved to", a.output)
    print("This is not a GGUF. Merge and quantize for the standalone desktop app.")
if __name__ == "__main__":
    main()
