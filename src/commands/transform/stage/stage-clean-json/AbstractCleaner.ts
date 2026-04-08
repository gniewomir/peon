import { Finder } from '../../lib/Finder.js';
import type { TSchema } from '../../../../schema/schema.js';

export abstract class AbstractCleaner extends Finder {
  abstract strategy(): string;
  abstract clean(input: unknown): TSchema;
}
