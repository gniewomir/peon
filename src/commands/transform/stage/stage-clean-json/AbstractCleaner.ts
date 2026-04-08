import { Finder } from '../../lib/Finder.js';
import type { TSchema } from '../../../../schema/schema.js';

export abstract class AbstractCleaner extends Finder {
  abstract strategy(): string;
  abstract clean(input: unknown): TSchema;

  protected normalizeSeniority(seniority: string): string {
    seniority = seniority.trim().toLowerCase();
    if (seniority === 'medium') {
      return 'regular';
    }
    if (seniority === 'mid') {
      return 'regular';
    }
    if (seniority === 'c_level') {
      return 'management';
    }
    return seniority;
  }
}
