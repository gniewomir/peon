import { describe, expect, it } from 'vitest';

import { cleanerByStrategySlug } from './index.js';

describe('cleanerByStrategySlug', () => {
  it('returns registered cleaners', () => {
    expect(cleanerByStrategySlug('nfj')).toBeDefined();
    expect(cleanerByStrategySlug('jji')).toBeDefined();
    expect(cleanerByStrategySlug('bdj')).toBeDefined();
  });

  it('returns undefined for unknown strategy', () => {
    expect(cleanerByStrategySlug('unknown')).toBeUndefined();
  });
});
