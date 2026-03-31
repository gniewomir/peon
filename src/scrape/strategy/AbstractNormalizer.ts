import { Finder } from './Finder.js';
import type { JobMetadata, NormalizedJson } from '../types/Job.js';

export abstract class AbstractNormalizer extends Finder {
  abstract clean(input: unknown, meta: JobMetadata): Promise<NormalizedJson>;
}
