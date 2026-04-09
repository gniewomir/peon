# Peon

CLI ETL pipeline for extracting IT-related jobs from Polish IT job boards, transforming them into a common data format, and loading them into a chosen data store.

## Architecture

Each ETL step (extract, transform, load) runs as a separate CLI script. Scripts coordinate through the file system: each step watches a directory for changes and writes its output to the next step's directory. A file is saved only when its content has changed — no change means no file system event and no downstream work. This makes the scripts independent: they can run concurrently, sequentially, or in isolation.

### Extract

The extract script scrapes registered data providers (job boards) in parallel. Each data provider has a dedicated scraping strategy that encapsulates its quirks. The scraper's only concern is fetching pages over HTTP — it does not validate or interpret the content it retrieves.

After scraping, each job offer has two sources of signal:

- **Structured data** — whatever the scraping strategy could extract directly from the listing page or API call (e.g., title, salary, location).
- **Raw HTML** — the full page content, which may contain additional structured data embedded as JSON-LD, microdata, or SPA hydration payloads.

Both are written to a staging directory for the transform step to consume.

### Transform

The transform script watches the staging directory and queues transformation steps for each job offer. Each step has zero or more file inputs and one file output. All extracted information — structured data, data parsed from raw HTML, and LLM-derived fields — is parsed, cleaned, normalized, and combined to fit a common schema guarded by Zod. Steps run in sequence:

1. **Structured data extraction** — parse additional structured data from raw HTML (JSON-LD, hydration data) and merge it with structured data already extracted during scraping. Treat all structured data as authoritative.
2. **LLM extraction** — for fields that cannot be extracted in structured form, convert HTML to Markdown (stripping as much noise as possible) and use an LLM to supplement missing fields.
3. **Disambiguation** — normalize terms (e.g., technology names, seniority levels) using a shared dictionary.
4. **Deduplication** — aggregate offers from the same source that refer to one position, then across sources.

Every transformation step has one or more guards attached. Guards run in sequence, inspecting the output to decide whether to advance the data to the next step, quarantine it, or trash it. Each guard decision is saved with its rationale before the data is moved.

### Load

Load is a future concern. The load script will watch the load directory and persist finalized offers to a chosen data store once the schema is stable and the transformation stages are complete.

## Token economy

- Serve unstructured inputs to the LLM as Markdown, stripping as much noise as possible from both HTML and the derived Markdown.
- Consider structured data authoritative; use the LLM only to fill the gaps.
- Revisit the schema often to determine which "fuzzy" fields provide an accurate signal.
- Establish rough daily limits for token input/output to keep worst-case costs somewhat predictable.
- Drop expired offers as early in the process as possible.
- Deduplicate as early in the process as possible.

## Implementation details

### Extraction

- Scraping from headless Chrome with a proxy using Puppeteer.
- Unhandled error during scraping recreates the browser with a new proxy.
  - Proxied browsers are cached and reused until an error.
  - The proxy gets removed from the pool after an error.
  - When the proxy pool is exhausted, a new proxy list is scraped from the web.
- Listings are cached for one day (subject to change).
- Job offer pages are cached for a week (subject to change).

### General

- Ability to run locally or be deployed to an external server.
- Ability to freely switch between local and cloud LLMs.
- Pluggable data-scraping and transformation strategies.
- Parallelization with limits (i.e., no more than X LLM requests running concurrently when using a local LLM).
