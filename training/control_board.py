#!/usr/bin/env python3
"""Separate COSM.OS training dashboard. Python 3.11 and CUDA recommended."""
import json
import queue
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"

class Board(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("COSM.OS // MODEL CONTROL BOARD")
        self.geometry("870x670")
        self.configure(bg="#0a1020")
        self.log_queue = queue.Queue()
        self.proc = None
        self.dataset = tk.StringVar(value=str(DATA / "train.jsonl"))
        self.epochs = tk.StringVar(value="2")
        self.rate = tk.StringVar(value="0.0002")
        self.rank = tk.StringVar(value="16")
        self.base = tk.StringVar(value="HuggingFaceTB/SmolLM2-1.7B-Instruct")
        self.output = tk.StringVar(value=str(ROOT / "outputs/cosmos-lora"))
        self.build()
        self.after(150, self.pump)

    def build(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame", background="#0a1020")
        style.configure("TLabel", background="#0a1020", foreground="#d8e4ff", font=("Segoe UI", 10))
        style.configure("TButton", padding=8)
        panel = ttk.Frame(self, padding=22)
        panel.pack(fill="both", expand=True)
        ttk.Label(panel, text="COSM.OS // TRAINING CONTROL BOARD", font=("Segoe UI", 17, "bold")).pack(anchor="w", pady=(0, 9))
        ttk.Label(panel, text="Import privately  |  review examples  |  fine-tune on GPU  |  export adapter").pack(anchor="w", pady=(0, 14))
        row = ttk.Frame(panel)
        row.pack(fill="x")
        ttk.Button(row, text="Import TXT / MD / JSON", command=self.import_files).pack(side="left", padx=(0, 8))
        ttk.Button(row, text="Select training JSONL", command=self.choose_dataset).pack(side="left", padx=(0, 8))
        ttk.Button(row, text="Count examples", command=self.count_examples).pack(side="left")
        for name, variable in (("Base HF model", self.base), ("Training dataset", self.dataset), ("LoRA output", self.output),
                               ("Epochs", self.epochs), ("Learning rate", self.rate), ("LoRA rank", self.rank)):
            line = ttk.Frame(panel)
            line.pack(fill="x", pady=(12, 0))
            ttk.Label(line, text=name, width=22).pack(side="left")
            ttk.Entry(line, textvariable=variable).pack(side="left", fill="x", expand=True)
        actions = ttk.Frame(panel)
        actions.pack(fill="x", pady=19)
        ttk.Button(actions, text="Start LoRA training", command=self.start_training).pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Stop", command=self.stop).pack(side="left")
        ttk.Label(panel, text="PROGRESS / OUTPUT").pack(anchor="w")
        self.log = tk.Text(panel, bg="#0d1729", fg="#d3dff7", insertbackground="white", font=("Consolas", 10), wrap="word")
        self.log.pack(fill="both", expand=True, pady=(7, 0))
        self.write("Memory import does not change model weights.")
        self.write("Actual LoRA training needs a CUDA GPU and supervised prompt/completion examples.")

    def write(self, message):
        self.log.insert("end", str(message) + "\n")
        self.log.see("end")

    def run_cmd(self, args, label):
        self.log_queue.put(label + ": " + " ".join(args))
        try:
            with subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                  encoding="utf-8", errors="replace", bufsize=1) as proc:
                self.proc = proc
                for line in proc.stdout:
                    self.log_queue.put(line.rstrip())
                self.log_queue.put(label + " exit code: " + str(proc.wait()))
        except Exception as exc:
            self.log_queue.put("ERROR: " + str(exc))
        finally:
            self.proc = None

    def import_files(self):
        paths = filedialog.askopenfilenames(title="Import private documents", filetypes=[("Text, Markdown, JSON", "*.txt *.md *.json")])
        if paths:
            args = [sys.executable, "-u", str(ROOT / "feed_data.py"), *paths, "--out", str(DATA)]
            threading.Thread(target=lambda: self.run_cmd(args, "Import"), daemon=True).start()

    def choose_dataset(self):
        filename = filedialog.askopenfilename(filetypes=[("JSONL", "*.jsonl")])
        if filename:
            self.dataset.set(filename)

    def count_examples(self):
        try:
            rows = [json.loads(line) for line in Path(self.dataset.get()).read_text(encoding="utf-8").splitlines() if line.strip()]
            self.write("Found " + str(len(rows)) + " supervised examples.")
        except Exception as exc:
            self.write("Could not read dataset: " + str(exc))

    def start_training(self):
        if self.proc and self.proc.poll() is None:
            messagebox.showwarning("Busy", "A job is already running.")
            return
        try:
            epochs = float(self.epochs.get())
            rate = float(self.rate.get())
            rank = int(self.rank.get())
            if not (0 < epochs <= 40 and 0 < rate < 0.1 and 1 <= rank <= 256):
                raise ValueError("Settings outside acceptable numeric range.")
        except ValueError as exc:
            messagebox.showerror("Settings", str(exc))
            return
        args = [sys.executable, "-u", str(ROOT / "train_lora.py"), "--dataset", self.dataset.get(),
                "--output", self.output.get(), "--base", self.base.get(),
                "--epochs", str(epochs), "--learning-rate", str(rate), "--rank", str(rank)]
        threading.Thread(target=lambda: self.run_cmd(args, "LoRA training"), daemon=True).start()

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            self.write("Stop requested.")

    def pump(self):
        try:
            while True:
                self.write(self.log_queue.get_nowait())
        except queue.Empty:
            pass
        self.after(150, self.pump)

if __name__ == "__main__":
    Board().mainloop()
