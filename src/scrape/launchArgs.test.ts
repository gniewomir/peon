import { describe, expect, it } from 'vitest';
import { assertLaunchArgsSafe } from './launchArgs.js';

describe('assertLaunchArgsSafe', () => {
  it('allows default hardening flags', () => {
    expect(() =>
      assertLaunchArgsSafe(['--disable-dev-shm-usage', '--proxy-server=http://x']),
    ).not.toThrow();
  });

  it('rejects --no-sandbox by default', () => {
    expect(() => assertLaunchArgsSafe(['--no-sandbox'])).toThrow(/sandbox/);
  });

  it('rejects --disable-setuid-sandbox by default', () => {
    expect(() => assertLaunchArgsSafe(['--disable-setuid-sandbox'])).toThrow(/sandbox/);
  });

  it('allows unsafe flags when PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX=1', () => {
    const prev = process.env.PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX;
    process.env.PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX = '1';
    try {
      expect(() => assertLaunchArgsSafe(['--no-sandbox'])).not.toThrow();
    } finally {
      if (prev === undefined) {
        delete process.env.PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX;
      } else {
        process.env.PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX = prev;
      }
    }
  });
});
