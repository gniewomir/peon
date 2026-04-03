import { Finder } from '../../lib/finder.js';
import type { CleanJson, JobMetadata } from '../../../types/Job.js';

export abstract class AbstractCleaner extends Finder {
  abstract strategy(): string;
  abstract clean(input: unknown, meta: JobMetadata): CleanJson;
}
