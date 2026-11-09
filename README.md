# COSM.OS LOCAL v0.1

**A fresh, standalone Windows desktop AI with the eight COSM.OS personas, seeded COSM.OS lore, local document memory, and an app-owned llama.cpp CPU engine. No Ollama.**

This is a new codebase, not a fork of the previous cosmos-desktop project. The operator controls the personas. The software is an instrument, not an oracle.

## The initial brain

The default base model is **SmolLM2 1.7B Instruct**, Q4_K_M GGUF, licensed Apache-2.0 by its upstream model authors. Its GGUF download is ~1.06 GB and is SHA-256 verified. On first setup, the app can download it; after that the model runs offline through a bundled llama.cpp Windows CPU process on localhost only. No other app or separate inference installation is needed.

A model file is NOT shipped in GitHub source or the Windows installer. Internet is required for first-time model download, then local conversation can work offline.

## First install

1. Download the Windows installer from a successful GitHub Actions workflow artifact, once a build exists.
2. Launch COSM.OS LOCAL.
3. Click Download model (first-time setup, approximately 1.06 GB).
4. Click Start engine to load the model on your CPU. Wait until the status says Ready.
5. Chat in Flux by default; use the persona sidebar or type /mode orion, Switch to Ripple, etc.

An optional finetuned model can be selected via Choose GGUF. The source weights are from SmolLM2 until you actually fine-tune and install a new GGUF.

## Develop on Windows 10/11

Requires Node.js 22+ and npm:

    npm install
    npm test
    powershell -ExecutionPolicy Bypass -File scripts/prepare-runtime.ps1
    npm start

Build an installer locally:

    npm run dist

The PowerShell prep script downloads and bundles the Windows x64 CPU llama.cpp runtime, including its required DLLs. The app starts/stops that local runtime itself. The GitHub Actions workflow performs the same preparation before packaging.

## Memory behavior

At first launch, a versioned collection of non-sensitive COSM.OS project lore is copied to a per-user local data file. Startup model instructions establish distinct personas, with Flux initially selected. You can import text, Markdown and JSON files from within the app to add chunked local reference notes.

Relevant notes are selected using lightweight lexical matching and included in the chat context. This is retrieval, not a trained neural weight update. Persona locks and conversation logs persist locally. Documents are never uploaded to a cloud chat service.

The local memory data file lives in the Electron userData folder. Keep it backed up. This v0.1 deliberately uses simple file storage and keyword recall, not a vector database or archive search UI.

## Separate fine-tuning control board

See training/README.md. A separate Tkinter window lets you feed .txt, .md and .json sources, review supervised prompt/completion counts, set epochs, learning rate and LoRA rank, and start/stop real GPU training.

A LoRA adapter must be merged and converted to GGUF before using it in the desktop app. Fine-tuning is NOT performed during installation and has NOT yet been run. The old Intel integrated GPU is not suited for that training workload.

## Security and limitations

- The GitHub repo is public. Do not commit private personal memories, health information, private chats or training datasets. Training data and model artifacts are gitignored.
- The local app launches a 127.0.0.1-only inference server. The user owns files and model paths.
- Imported documents are untrusted reference material, never app commands.
- The chat has an 18-message context limit and uses a 2048-token server context configured for CPU inference; very long chats are truncated.
- This is an initial engineering build and must be tested on the ThinkCentre. A green CI workflow proves packaging, not inference speed or end-to-end model correctness.
- The first version has no voice synthesis yet. The previous stable voice design is reference material for a later feature.

Recommended first milestone: test installer, first-download integrity, streaming output, all persona locks, memory import, then optimize speed and add voice.

License for SmolLM2 and llama.cpp are upstream and separate from this project.
