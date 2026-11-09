# COSM.OS Training Control Board

A separate Python window for private document ingestion and genuine LoRA fine-tuning. The COSM.OS desktop app already has eight built-in persona prompts and public-safe project lore. Training is optional.

## Import data

Use Python 3.11, then run:

    python training/feed_data.py "C:\path\to\notes" "C:\path\to\example.json"

Two private (gitignored) outputs:

- training/data/memory.jsonl contains reference text from TXT, Markdown and JSON. It is not weight training.
- training/data/train.jsonl contains supervised prompt/completion examples when the source JSON has recognized user-assistant pairs.

Review these carefully before training. Raw prose is not secretly converted into fake conversations. The in-app Import Memory feature currently uses a separate local data store.

## Launch the window

    py -3.11 -m venv training\.venv
    training\.venv\Scripts\activate
    pip install -r training\requirements.txt
    python training\control_board.py

Use Import, Count Examples, the LoRA settings and Start/Stop buttons. A CUDA-enabled GPU is required. The ThinkCentre is a runtime target, not a practical training machine.

## Fine-tune from command line

    python training/train_lora.py --dataset training/data/train.jsonl --epochs 2 --rank 16

The result is an adapter, not a complete standalone model. Merge it:

    python training/merge_adapter.py --adapter training/outputs/cosmos-lora --out training/outputs/cosmos-merged

With a matching llama.cpp checkout, convert and quantize:

    python llama.cpp/convert_hf_to_gguf.py training/outputs/cosmos-merged --outfile cosmos-f16.gguf --outtype f16
    llama-quantize cosmos-f16.gguf COSMOS-1.7B-Q4_K_M.gguf Q4_K_M

Select the final GGUF in COSM.OS LOCAL using Choose GGUF.

Important: never commit private personal history or unreviewed conversation exports into public GitHub. Fine-tuning can memorize personal data; use local memory for factual long-term recall.
