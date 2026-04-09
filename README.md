# Peon

A CLI-based ETL pipeline for extracting IT-related jobs from Polish IT job boards, transforming them into a common data format, and loading them into a chosen data store.

## Vocabulary

- **Step** — one of the three top-level ETL scripts: extract, transform, or load.
- **Stage** — a single transformation within the transform step (e.g., structured data extraction, LLM extraction).
- **Guard** — an object attached to a stage that verifies its output and decides the fate of the entire job offer directory (advance, quarantine, or trash).
- **Data provider** — a job board or API that the extract step scrapes (e.g., NoFluffJobs, JustJoinIT).
- **Strategy** — a data-provider-specific implementation that encapsulates scraping or transformation quirks.
- **Job offer directory** — the per-offer directory under staging that accumulates all artifacts (outputs, errors, guard rationales) across extraction and transformation.
- **Artifact** — any file produced by a stage or guard: stage output, error log, or guard rationale.
- **Quarantine** — where guards move offers that fail quality checks but may be recoverable or worth investigating.
- **Trash** — where guards move offers that are irrelevant or unsalvageable.

## Architecture

Each ETL step (extract, transform, load) runs as a separate CLI script. Scripts coordinate through the file system: each step watches a directory for changes and writes its output to the next step's directory. A file is saved only when its content has changed — no change means no file system event and no downstream work. This makes the scripts independent: they can run concurrently, sequentially, or in isolation.

### Extract

The extract script scrapes registered data providers in parallel. Each data provider has a dedicated scraping strategy that encapsulates its quirks. The scraper's only concern is fetching pages over HTTP — it does not validate or interpret the content it retrieves.

After scraping, each job offer provides two sources of data:

- **Structured data** — whatever the scraping strategy could extract directly from the listing page or API call (e.g., title, salary, location).
- **Raw HTML** — the full page content, which may contain additional structured data embedded as JSON-LD, microdata, or SPA hydration payloads.

Both are written to a job offer directory under the staging directory for the transform step to consume.

### Transform

The transform script watches the staging directory and queues transformation stages for each job offer. Each stage has zero or more file inputs and one file output. All extracted information — structured data, data parsed from raw HTML, and LLM-derived fields — is parsed, cleaned, normalized, and combined to fit a common schema guarded by Zod. The exact ordering and granularity of stages are still in flux, but the known transformation concerns are:

- **Structured data extraction** — parse additional structured data from raw HTML (JSON-LD, hydration data) and merge it with structured data already extracted during scraping. Treat all structured data as authoritative.
- **LLM extraction** — for fields that cannot be extracted in structured form, convert HTML to Markdown (stripping as much noise as possible) and use an LLM to supplement missing fields.
- **Disambiguation** — normalize terms (e.g., technology names, seniority levels) using a shared dictionary.
- **Deduplication** — aggregate offers from the same source that refer to one position, then across sources.

All artifacts from each transformation stage — both outputs and errors — are saved in the job offer directory. Every stage has one or more guards attached. After a stage completes, its guards run in sequence, evaluating the job offer directory as a whole. A guard may decide to advance the data to the next stage, or move the entire job offer directory (with all of its artifacts) to quarantine or trash. When transformation is complete and all guards pass, the directory is moved to the load directory.

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

### Extract

- Scrape using headless Chrome and Puppeteer, utilizing proxies.
- Handle scraping errors by automatically recreating the browser with a new proxy.
  - Cache and reuse proxied browsers until an error occurs.
  - Remove failing proxies from the active pool immediately.
  - Scrape a new proxy list from the web automatically when the pool is exhausted.
- Cache listings for one day (subject to change).
- Cache job offer pages for one week (subject to change).

### General

- Can be run locally or deployed to an external server.
- Supports seamless switching between local and cloud LLMs.
- Features pluggable scraping and transformation strategies.
- Provides configurable parallelization limits (e.g., restricting the maximum number of concurrent LLM requests when using a local model).
