# Problem statement

We want to process a lot of data, parallelizing processing when we can, with a way to limit concurrency so we don’t run out of resources (file descriptors, memory, CPU, etc.).

# Problem at hand

- We want to be able to pick up processing after a process restart, using the content of the staging directory as our state.
  - This means that there might be up to tens of thousands of directories, each with multiple (~10+) files.
  - This means that any file watcher might run out of file descriptors—if not during normal operations when we keep up with incoming data and remove it from the watched scope, then for sure after longer downtime (which will happen in my use case).
  - As scripts need to work both on a server (costs resources but 50k→1M FDs is an option) and locally (up to 65k+ to be safe), then:
    - a solution watching only directories might work with increased FD limits for the process (it is very unlikely for the dataset to grow above 65k directories)
    - a solution watching all files, while it might be elegant, in the worst-case scenario (65k \* 10+ files = 650k FDs needed) is not safe, realistic, or sane
  - File watcher with polling: inefficient; consumes a lot of resources needed for actual processing.

## Options

- Grilled: [Scan & schedule wt concurrency limits](./ADR-scan-cycles.md)
  - pro: easy to reason about
  - pro: fits extractor loop
- Watch only directories in staging to initiate transformations on new data arrival
  - then there is a need to:
    - after initiating work for a directory, keep track of emitted artifacts
      - queue them (we need to control concurrency for stages)
      - check if they fulfill preconditions of the next transformation stage
  - con: advantages are quickly lost in the complexity of ensuring that we are not running multiple transformations for the same directory at the same time, and that we do not parallelize too-heavy operations with heavily limited throughput (i.e., local LLM for unstructured data extraction)
  - con: two mental models—how we initiate and how we proceed—can be somewhat aligned, but we still end up with a loop over a queue
- Watch everything by default, and when we approach the limits of available FDs, or we have an unsustainably long backlog, move the oldest entries out of scope as stalled—extraction will run in a loop anyway, so if relevant they will return
  - pro: elegant and conceptually simple
  - con: advantages are quickly lost in the complexity of ensuring that we are not running multiple transformations for the same directory at the same time, and that we do not parallelize too-heavy operations with heavily limited throughput (i.e., local LLM for unstructured data extraction)
  - con: two mental models—how we initiate and how we proceed—can be somewhat aligned, but we still end up with a loop over a queue

# Locked design decisions

- As new data arrives in the staging directory, we need to transform it.
  - Related data is always stored in one directory
  - Transformations are done in stages
  - Stages decide if they should run based on what artifacts are already present (if all required artifacts are present)
  - Stages are not explicitly ordered—they run based on the available artifacts, and might run in parallel
  - Stages can have multiple inputs, but only one output
  - Each stage may decide to end the transformation process by moving the directory out of the transformation scope (staging directory)
- Creating and removing directories have to be atomic (rename/move)
  - Eliminates a whole category of problems (dir exists, but not all input artifacts exist)
    - Which is not really a problem, as every stage checks its preconditions anyway
  - Disk operations, when possible, are not full writes, but just metadata operations, which will reduce wear & tear
