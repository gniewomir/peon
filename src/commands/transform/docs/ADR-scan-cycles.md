## Problem statement

We want to process a lot of data, parallelizing processing when we can, while limiting concurrency to not run out of resources (file descriptors, memory, CPU, etc.).

## Problem at hand

We want to be able to pick up processing after process restart using the staging directory as our state.

- There might be 10s of thousands of job directories, each with multiple (~10+) files.
- A file watcher over the whole tree will run out of file descriptors (if not during normal operations, then for sure after longer downtime).

## Decision

Use a **scan-only orchestrator** (no filesystem watchers) that continuously scans `stagingDir` and runs transformation stages until each job directory reaches a fixpoint (no more applicable stages), with bounded concurrency enforced per stage and strict per-job serialization.

## Goals

- Process continuously arriving jobs from Extract.
- Be restart-resumable without external state stores.
- Keep resource usage bounded and predictable (especially file descriptors).
- Allow staged transformations with guards that can move jobs out of scope (load/quarantine/trash).

## Non-goals

- Exactly-once processing.
- Sub-second or low-latency scheduling. Best-effort latency (minutes) is acceptable.
- Using filesystem watchers over the full staging tree.

## Locked design decisions

- As new data arrives in the staging directory, we need to transform it.
- Related data is always stored in one job directory.
- Transformations are done in stages.
- Stages decide if they should run based on what artifacts are already present.
- Stages can run in parallel across different job directories.
- Stages can have multiple inputs, but only one output.
- Each stage may end the transformation process by moving the directory out of transformation scope (staging directory) via guards.

Additionally locked by this ADR:

- The orchestrator is **scan-only** (no chokidar/FS watching).
- Work is processed **at-least-once** per job directory.
- When a stage emits a new artifact, we must run any newly applicable stages that depend on that artifact (run-to-fixpoint).
- Per-job serialization is enforced centrally (the orchestrator never runs two stages for the same job directory concurrently).
- Registration order is the tie-breaker when multiple stages are applicable.

## Correctness model

- **At-least-once**: stages may be retried after restart; correctness relies on artifact-driven preconditions.
- **Run-to-fixpoint**: for a given job directory, keep applying stages while any stage is applicable. If a stage writes a new artifact, re-evaluate applicability.
- **State = artifacts on disk**: the presence and freshness of artifacts in a job directory is the only source of truth for what should run next.

## Filesystem contracts and invariants

### Extract atomic publish

- Extract must publish a new job by **atomically moving/renaming the whole job directory into `stagingDir`** (the directory appears “all at once”).
- After publish, the job directory is **immutable from upstream**; only the transformer writes outputs.

### Artifact catalog (single source of truth)

- Artifact filenames are defined in `src/lib/artifacts.ts` (`KnownArtifactsEnum`, `artifactFilename`).
- Stages reference artifacts only through `KnownArtifactsEnum` (no ad-hoc filenames).

### Write discipline

- Each stage writes **only its declared single output artifact** (no auxiliary files).
- Artifact writes are **atomic** (write temp then rename).
- Artifact writes are **content-aware**: do not rewrite identical content (prevents mtime churn and false “progress”).

## Stage applicability and invalidation

For a given job directory `dir` and stage `S`:

- `S` is applicable if:
  - All required **input artifacts exist**, and
  - Output artifact is **missing**, OR at least one input artifact has `mtime > output.mtime`.

This enables restart resume and reprocessing when upstream inputs are newer than outputs.

## Scheduling, backpressure, and ordering

### Directory discovery

- The orchestrator scans **only `stagingDir`**. If guards move a job directory to `load/`, `quarantine/`, or `trash/`, it naturally disappears from future scans.

### Scan policy

- Each cycle:
  - List all job directories under `stagingDir`.
  - Take a snapshot and sort **oldest → newest** by **directory mtime**.
  - For each directory, perform a cheap `readdir` to learn which artifacts exist.
  - Only `stat`/read files for the stage chosen to run.

Scan cycle duration may exceed 30s at peak backlog; latency is best-effort.

### Per-job serialization

- The orchestrator ensures at most **one stage runs at a time per job directory**.
- Mid-scan moves are handled by re-checking that `dir` still exists under `stagingDir` immediately before executing a stage; if not, skip.

### Per-stage concurrency

- Each stage declares a hardcoded concurrency limit via its public API:
  - `concurrencyLimit(): number` returning an integer `>= 0`
    - `0` disables the stage (never scheduled)
    - `>= 1` is the max concurrent executions of that stage across all jobs

- There is **no global concurrency cap** beyond per-stage limits.

### Tie-breaking when multiple stages are applicable

- For a job directory, the orchestrator loops over **registered stages in registration order** and selects the **first stage** that reports it is applicable.
- Registration order is the tie-breaker when multiple stages are applicable.

## Guards and job lifecycle

- Running a stage includes running its guards afterwards.
- Guards may decide to move the entire job directory to:
  - `load/` (success / terminal)
  - `trash/` (terminal discard)
  - `quarantine/` (terminal failure or policy stop)
- Since scans only consider `stagingDir`, moved jobs are out of scope for future work.

## Progress, backoff, and termination

### Progress

- Progress is defined as: **any new artifact written** (i.e., a stage successfully emits an artifact with changed content).

### Backoff

- The orchestrator runs in a continuous scan loop with backoff:
  - If a cycle makes progress, reset backoff.
  - If a cycle makes no progress, increase backoff up to a maximum.

### Batch termination

- Batch mode: exit after being idle for `T`.
- Idle is defined as: **no new artifacts written** for duration `T`.

## Stalled job policy

A job directory is considered stalled when:

- It has spent more than a configurable wall-clock threshold time in staging (derived from filesystem `birthtime/ctime`), AND
- Its directory mtime did not change over that interval (unchanged signal).

Action:

- Move job directory to **quarantine**, and write `errors.json` stating the reason is `stalled`.

Note:

- Guards are only evaluated after a stage run; therefore a permanently blocked job will only be quarantined by the stalled-job policy (not by guards).

## Orchestrator algorithm (pseudocode)

```ts
loop:
  dirs = listJobDirs(stagingDir)               // scan-only, all dirs
  dirsSorted = sortByDirMtimeAscending(dirs)   // snapshot order: oldest -> newest

  progress = false

  for dir in dirsSorted:
    if jobInFlight(dir): continue              // per-job serialization (central)
    if isStalled(dir): quarantine(dir, errorsJson("stalled")); continue
    if !existsInStaging(dir): continue         // handle mid-scan moves

    available = readdir(dir)                   // filenames only

    // fixpoint loop
    while true:
      stage = firstRegisteredStageWhereApplicable(stage, dir, available)
      if !stage: break
      if stage.concurrencyLimit() == 0: break  // stage disabled
      if stageSlotsFull(stage): break

      markJobInFlight(dir)
      didWriteNewArtifact = runStage(stage, dir)  // atomic + content-aware
      unmarkJobInFlight(dir)

      if didWriteNewArtifact:
        progress = true
        available = readdir(dir)               // refresh after mutation
      else:
        // no-op write; treat as no progress for this job dir
        available = readdir(dir)               // still refresh to be safe, but progress remains false

  if progress:
    resetBackoff()
  else:
    increaseBackoffUpToMax()
    if idleForT(noNewArtifactsWritten): exit
    sleep(backoff)
```

## Consequences

- Eliminates full-tree watcher fd exhaustion risk.
- Restart is straightforward: artifacts on disk define what is applicable.
- Latency is best-effort and depends on scan loop + backoff.
- Requires strict atomic publish from Extract and atomic/content-aware writes from stages.
- Directory mtime is used for oldest→newest ordering; ordering is snapshot per cycle.
