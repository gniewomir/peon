# Peon

CLI ETL pipeline for extracting IT-related jobs from Polish IT job boards, transforming them into a common data format, and loading them into a chosen data store.

Target architecture:

- each ETL step (extract, transform, load) runs as a separate CLI script
  - each CLI script can run concurrently with its peers or completely independently
  - as scripts operate on files and listen to file changes:
    - save only if content changed
      - if content didn't change; no save; no file system event; following steps are not triggered
      - bonus: it will limit SSD wear
  - extraction (scraping)
    - parallelized scraping of registered data providers (job boards) - good enough for this use case
    - scraping from headless Chrome with a proxy using Puppeteer
    - unhandled error during scraping recreates browser with a new proxy
      - proxied browsers are cached and reused until an error
      - proxy gets removed from the pool after an error
      - when the proxy pool is exhausted, a new proxy list is scraped from the web
    - data-provider quirks abstracted to a data-provider-specific strategy
    - listings are cached for one day (subject to change)
    - job offer pages are cached for a week (subject to change)
    - inevitable errors (e.g., not hydrated web pages) will be caught by transformation step guards;
      scraper's concern is HTTP, not validity/quality of scraped data
  - after extraction, the transform script reacts to file changes in the staging folder
    - transformation steps of one job offer directory run are queued
    - each transformation has 0 or more file inputs, and one file output
    - transformation steps have guards attached
      - they quarantine or trash irrelevant or low-quality data
      - they can decide to move transformed data to the load stage
      - guard decision is saved with its rationale before moving data to the appropriate directory
  - after transformation, the load script reacts to file changes in the load folder and loads to the chosen store

Token economy goals:

- serve unstructured inputs to the LLM as Markdown, stripping as much noise as possible from both HTML and the derived Markdown
- consider structured data authoritative, use LLM to fill the gaps
- revisit the schema often to determine which "fuzzy" fields provide an accurate signal
- establish rough daily limits for token input/output to keep worst-case costs somewhat predictable
- drop expired offers as early in the process as possible
- deduplicate as early in the process as possible

Intended feature set:

- ability to run locally or be deployed to an external server
- ability to freely switch between local and cloud LLMs
- pluggable data-scraping and transformation strategies
- parallelization with limits (i.e., no more than X LLM requests running concurrently when using a local LLM)
- disambiguation of terms using a shared dictionary
- deduplication by aggregating offers from the same source that refer to one position (NFJ!)
- deduplication by aggregating offers from different sources that refer to one position
