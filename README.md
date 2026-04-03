# Peon

Work in progress: A CLI ETL pipeline for extracting IT-related jobs from Polish IT job boards, transforming them into a common data format, and loading them into a chosen data store.

Intended feature set:

- Ability to run locally using local LLMs or be deployed to an external server
- Aggressive caching to be fair to job boards and eliminate superfluous work
- Pluggable data scraping and data cleaning strategies
- Parallelization with limits (i.e., no more than X LLM requests running concurrently)
- Incremental processing: the next ETL step is run when prerequisites are fulfilled
- Quarantine for failing workloads
- Combining scraped structured data with LLM-based parsing of unstructured data to get uniform and mostly complete output
- Disambiguation of used terms using shared dictionary
- Deduplication by aggregation of offers from diffrent sources refering to one position
- Ability to filter offers from multiple sources using uniform criteria
- Ability to filter scraped jobs by dimensions non-existent on job boards (e.g., filtering out corporate or startup environments, finding companies offering RSU packages, etc.)

## Local LLM: Qwen2.5 7B (Apple Silicon)

Peon can call a **local** model for structured extraction and similar tasks. The recommended setup on Mac with Apple Silicon is **[Ollama](https://ollama.com/)**, which downloads models outside this repository and serves them over HTTP on your machine.

### 1. Install Ollama

- Download the macOS app from [ollama.com/download](https://ollama.com/download), or install with Homebrew:

  ```bash
  brew install ollama
  brew services start ollama
  ```

- Start Ollama (the menu bar app on a typical install, or ensure the `ollama` service is running). The API listens at `http://127.0.0.1:11434` by default.

### 2. Pull the model

This downloads **Qwen2.5 7B** into Ollama’s cache (on the order of a few gigabytes, depending on variant and quantization). It does **not** add large files to the Peon git repo.

```bash
ollama pull qwen2.5:7b
```

### 3. Verify

```bash
ollama run qwen2.5:7b
```

You should get an interactive prompt. Exit with `Ctrl+D` or `/bye` (depending on your Ollama version).

List installed models:

```bash
ollama list
```

### 4. Use from Peon (or any client)

With Ollama running, HTTP clients can use the [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md), for example `POST http://127.0.0.1:11434/api/chat` with `"model": "qwen2.5:7b"`.

### Apple Silicon notes

- **Memory:** 7B models in typical quantized form fit comfortably on many Apple Silicon Macs; on **16 GB unified RAM**, avoid very large context windows and other heavy apps at the same time if you see slowdown or swapping.
- **Performance:** Inference runs on the GPU via Metal; the first run after pull may be slower while the runtime warms up.

### Troubleshooting

- **`ollama: command not found`:** Install Ollama and ensure your shell can find it (restart the terminal after installing the app, or use the full path from the installer).
- **Connection refused on port 11434:** Start the Ollama application or the `ollama` background service.
- **Out of memory or very slow:** Use a smaller context, close other memory-heavy processes, or pick a smaller model tag in Ollama’s library if you need a lighter footprint.
