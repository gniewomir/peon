import { KnownArtifactsEnum } from '../../lib/artifacts.js';

export type JobDirArtifacts = {
  /**
   * File names present in the job directory (e.g. "raw.job.json").
   */
  present: Set<KnownArtifactsEnum>;
  /**
   * Best-effort mtime (ms) for present files.
   */
  mtimeMs: Map<KnownArtifactsEnum, number>;
};
