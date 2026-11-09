#!/usr/bin/env python3
"""Convert private TXT/MD/JSON into memory chunks and, where possible, supervised examples."""
import argparse
import hashlib
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"

def chunks(text, limit=300):
    words = str(text).split()
    for start in range(0, len(words), limit):
        item = " ".join(words[start:start + limit])
        if len(item) >= 12:
            yield item

def examples(value):
    if isinstance(value, list):
        for item in value:
            yield from examples(item)
    elif isinstance(value, dict):
        if isinstance(value.get("messages"), list):
            messages = value["messages"]
            for i, current in enumerate(messages):
                if isinstance(current, dict) and current.get("role") == "assistant" and isinstance(current.get("content"), str):
                    prior = next((v for v in reversed(messages[:i]) if isinstance(v, dict) and v.get("role") == "user" and isinstance(v.get("content"), str)), None)
                    if prior:
                        yield {"prompt": prior["content"], "completion": current["content"]}
        if isinstance(value.get("prompt"), str) and isinstance(value.get("completion"), str):
            yield {"prompt": value["prompt"], "completion": value["completion"]}
        if isinstance(value.get("instruction"), str) and isinstance(value.get("output"), str):
            yield {"prompt": value["instruction"], "completion": value["output"]}
        for key, item in value.items():
            if key != "messages" and isinstance(item, (dict, list)):
                yield from examples(item)

def flatten(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for entry in value:
            yield from flatten(entry)
    elif isinstance(value, dict):
        if isinstance(value.get("role"), str) and isinstance(value.get("content"), str):
            yield value["role"] + ": " + value["content"]
        else:
            for key, item in value.items():
                if key not in ("id", "timestamp"):
                    yield from flatten(item)

def ingest(paths, out=DATA):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    memory, training, seen = [], [], set()
    for entry in paths:
        root = Path(entry).expanduser()
        if not root.exists():
            raise FileNotFoundError(root)
        candidates = sorted(root.rglob("*")) if root.is_dir() else [root]
        for file in candidates:
            if not file.is_file() or file.suffix.lower() not in (".txt", ".md", ".json"):
                continue
            if file.stat().st_size > 32 * 1024 * 1024:
                print("Skipping large file:", file)
                continue
            raw = file.read_text(encoding="utf-8-sig", errors="replace")
            parsed = json.loads(raw) if file.suffix.lower() == ".json" else raw
            plain = "\n".join(flatten(parsed)) if isinstance(parsed, (list, dict)) else raw
            for text in chunks(plain):
                digest = hashlib.sha256(text.encode()).hexdigest()
                if digest not in seen:
                    seen.add(digest)
                    memory.append({"source": file.name, "content": text})
            if isinstance(parsed, (list, dict)):
                training.extend(row for row in examples(parsed) if row["prompt"].strip() and row["completion"].strip())
            print("Imported:", file.name)
    for filename, rows in (("memory.jsonl", memory), ("train.jsonl", training)):
        with (out / filename).open("w", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"{len(memory)} memory chunks, {len(training)} supervised examples saved in {out}")
    print("No model weights have changed. No files uploaded.")
    return len(memory), len(training)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import private COSM.OS documents as memory or fine-tuning examples.")
    parser.add_argument("paths", nargs="+")
    parser.add_argument("--out", default=str(DATA))
    args = parser.parse_args()
    ingest(args.paths, args.out)
