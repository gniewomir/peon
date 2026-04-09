# Peon

CLI ETL pipeline for extracting IT-related jobs from Polish IT job boards, transforming them into a common data format, and loading them into a chosen data store.

Target architecture:

- each ETL step (extract, transform, load) runs as a separate CLI script
  - each CLI script can run concurrently with its peers or completely independently
  - extraction (scraping) is parallelized at the data-provider (job-board) level
    - there is no need for near real-time scraping
    - data-provider quirks are abstracted to a data-provider strategy
    - listings are cached for one day (subject to change)
    - job offer pages are ached for a week (subject to change)
  - after extraction, transform script reacts to file changes in the staging folder
    - transformation steps of one job offer directory run are queued
    - each transformation has 0 or more file inputs, and one file output
    - transformation steps have guards attached
      - they quarantine or trash irrelevant or low quality data
      - they can decide to move transformed data to load stage
      - guard decision is saved with its rationale before moving data to appropriate directory
  - after transformation, load script reacts to file changes in the load folder and loads to chosen store

Token economy goals:

- serve unstructured inputs to the LLM as markdown, stripping as much noise as possible from both HTML and therefore derived markdown
- consider structured data authoritative, use LLM to fill the gaps
- revisit the schema often to determine which "fuzzy" fields provide an accurate signal
- establish rough daily limits for token input/output to keep worst-case costs somewhat predictable
- drop expired offers as early in the process as possible
- deduplicate as early in the process as possible

Intended feature set:

- ability to run locally or be deployed to an external server
- ability to freely switch between local and cloud LLMs
- pluggable data-scraping and transformation strategies
- parallelization with limits (i.e., no more than X LLM requests running concurrently when using local LLM)
- disambiguation of terms using a shared dictionary
- deduplication by aggregating offers from same source that refer to one position (NFJ!)
- deduplication by aggregating offers from different sources that refer to one position
