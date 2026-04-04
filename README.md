# Peon

Work in progress: a CLI ETL pipeline for extracting IT-related jobs from Polish IT job boards, transforming them into a common data format, and loading them into a chosen data store.

Intended architecture:

- each ETL step (extract, transform, load) runs as a separate CLI script
  - each CLI script can run concurrently with its peers or completely independently
  - after extraction, each script reacts to staging changes and performs work if required inputs become available
- extraction (scraping) is parallelized at the data-provider level, but not deeper
  - no DDoSing data providers
  - unstructured data processing, not scraping, seems to be the bottleneck (subject to change with a switch to a cloud-based LLM)

Data quality goals:

- data-quality gate as a transformation stage
  - if a cheaper model fails to extract enough information, use a more powerful one
  - if there are still quality issues, quarantine pending investigation

Token economy goals:

- serve unstructured inputs to the LLM as markdown, stripping as much noise as possible from both HTML and derived markdown
- consider structured data authoritative; craft a minimal prompt only to fill gaps (if any)
- revisit the schema often to determine which "fuzzy" fields add real value and provide an accurate signal
- use the cheapest possible model to parse unstructured inputs, then combine the results with available structured data
- establish rough daily limits for token input/output to keep worst-case costs somewhat predictable
- drop expired offers as early in the process as possible
- deduplicate as early in the process as possible

Intended feature set:

- ability to run locally or be deployed to an external server
- ability to freely switch between local and cloud LLMs
- aggressive caching to be fair to job boards
- pluggable data-scraping and data-cleaning strategies
- parallelization with limits (i.e., no more than X LLM requests running concurrently)
- quarantine for failing workloads
- combining scraped structured data with LLM-based parsing of unstructured data to get uniform, mostly complete output
- disambiguation of terms using a shared dictionary
- deduplication by aggregating offers from different sources that refer to one position
- ability to filter offers from multiple sources using uniform criteria
- ability to filter scraped jobs by dimensions that do not exist on job boards (e.g., filtering out corporate or startup environments, finding companies that offer RSU packages, etc.)

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
