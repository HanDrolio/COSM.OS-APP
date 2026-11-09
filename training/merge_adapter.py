#!/usr/bin/env python3
"""Merge a PEFT LoRA adapter and save Hugging Face weights for GGUF conversion."""
import argparse
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="HuggingFaceTB/SmolLM2-1.7B-Instruct")
    p.add_argument("--adapter", default="training/outputs/cosmos-lora")
    p.add_argument("--out", default="training/outputs/cosmos-merged")
    a = p.parse_args()
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
    base = AutoModelForCausalLM.from_pretrained(a.base, torch_dtype="auto", device_map="cpu")
    merged = PeftModel.from_pretrained(base, a.adapter).merge_and_unload()
    merged.save_pretrained(a.out, safe_serialization=True)
    AutoTokenizer.from_pretrained(a.base).save_pretrained(a.out)
    print("Merged model saved to", a.out)
    print("Convert with llama.cpp/convert_hf_to_gguf.py, then quantize Q4_K_M.")
if __name__ == "__main__":
    main()
