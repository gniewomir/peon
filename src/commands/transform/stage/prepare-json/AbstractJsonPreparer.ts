import type { JobMetadata } from '../../../types/Job.js';

export abstract class AbstractJsonPreparer {
  abstract strategy(): string;
  abstract prepare(input: unknown, meta: JobMetadata): Record<string, unknown>;
}
