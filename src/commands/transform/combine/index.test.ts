import { describe, expect, it } from 'vitest';

import { combineJobData } from './index.js';

describe('combineJobData', () => {
  it('keeps clean expires when already present', () => {
    const combined = combineJobData({
      strategySlug: 'nfj',
      markdown: '- Offer valid until: 12.04.2026',
      interrogated: { foo: 'bar' },
      clean: {
        url: 'u',
        company: 'c',
        position: 'p',
        seniority_level: '',
        contract: [],
        locations: [],
        expires: '2025-01-01T00:00:00.000Z',
        required_skills: [],
      },
    });

    expect(combined.clean.expires).toBe('2025-01-01T00:00:00.000Z');
  });

  it('falls back to markdown expiry for nfj', () => {
    const combined = combineJobData({
      strategySlug: 'nfj',
      markdown: '- Offer valid until: 12.04.2026',
      interrogated: {},
      clean: {
        url: 'u',
        company: 'c',
        position: 'p',
        seniority_level: '',
        contract: [],
        locations: [],
        expires: '',
        required_skills: [],
      },
    });

    expect(combined.clean.expires.startsWith('2026-04-12')).toBe(true);
  });
});
