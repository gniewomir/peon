import { describe, expect, it, vi, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';

import { ProxyRegistry } from './ProxyRegistry.js';
import { statsContext } from '../../../../lib/stats.js';
import type { Logger } from '../../../../lib/logger.js';

vi.mock('./proxy-scraper.js', () => ({
  findProxies: vi.fn(async () => [] as string[]),
}));

function testLogger() {
  const noop = () => {};
  const logger: Logger = {
    log: noop,
    warn: noop,
    error: noop,
    debug: noop,
    withSuffix: () => logger,
  };
  return logger;
}

function tmpFile(name: string): string {
  return path.join(os.tmpdir(), `peon-${name}-${process.pid}-${randomUUID()}.json`);
}

describe('ProxyRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promotes to reliable after any best streak >= 10', async () => {
    const file = tmpFile('promote');
    await statsContext('test_').withStats(async () => {
      const r = new ProxyRegistry(testLogger(), { persistencePath: file, random: () => 0 });
      r.noteSeen('1.1.1.1:443', 'test', Date.now());
      const lease = await r.acquire('c1');
      for (let i = 0; i < 10; i++) r.reportSuccess(lease, 10 + i);
      r.release(lease);

      await r.save();
      const saved = JSON.parse(await fs.readFile(file, 'utf8'));
      expect(saved.entries['1.1.1.1:443'].status).toBe('reliable');
      expect(saved.entries['1.1.1.1:443'].bestStreak).toBe(10);
    });
  });

  it('demotes to trash after 3 failures at first attempt, without reliable->known downgrade', async () => {
    const file = tmpFile('demote');
    await statsContext('test_').withStats(async () => {
      const r = new ProxyRegistry(testLogger(), { persistencePath: file, random: () => 0 });
      r.noteSeen('2.2.2.2:443', 'test', Date.now());
      const lease = await r.acquire('c1');

      // First achieve reliability.
      for (let i = 0; i < 10; i++) r.reportSuccess(lease, 100 + i);

      // Now fail at first attempt twice - should stay reliable.
      r.reportFailure(lease, 200); // currentStreak resets to 0
      r.reportFailure(lease, 201); // failure at first attempt #1
      r.reportFailure(lease, 202); // failure at first attempt #2

      await r.save();
      let saved = JSON.parse(await fs.readFile(file, 'utf8'));
      expect(saved.entries['2.2.2.2:443'].status).toBe('reliable');

      // Third failure at first attempt => trash.
      r.reportFailure(lease, 203);
      r.release(lease);
      await r.save();
      saved = JSON.parse(await fs.readFile(file, 'utf8'));
      expect(saved.entries['2.2.2.2:443'].status).toBe('trash');
    });
  });

  it('leases are exclusive: second consumer cannot acquire the same proxy', async () => {
    const r = new ProxyRegistry(testLogger(), { random: () => 0 });
    r.noteSeen('3.3.3.3:443', 'test', Date.now());
    const lease1 = await r.acquire('c1');
    await expect(r.acquire('c2')).rejects.toThrow(/No proxy available/);
    r.release(lease1);
    const lease2 = await r.acquire('c2');
    expect(lease2.proxyUrl).toBe('3.3.3.3:443');
  });

  it('falls back to known when reliable queue is fully leased', async () => {
    const r = new ProxyRegistry(testLogger(), { random: () => 0.0, reliablePickChance: 0.7 });
    r.noteSeen('10.10.10.10:443', 'test', Date.now());
    const reliableLease = await r.acquire('c1');
    for (let i = 0; i < 10; i++) r.reportSuccess(reliableLease, 10 + i);
    // Keep the reliable proxy leased (do not release), simulating sticky consumer.

    r.noteSeen('11.11.11.11:443', 'test', Date.now());
    const lease2 = await r.acquire('c2');
    expect(lease2.proxyUrl).toBe('11.11.11.11:443');
  });

  it('selects reliable vs known by configured random (70/30)', async () => {
    const rReliable = new ProxyRegistry(testLogger(), {
      random: () => 0.0,
      reliablePickChance: 0.7,
    });
    rReliable.noteSeen('4.4.4.4:443', 'test', Date.now());
    const leaseA = await rReliable.acquire('c1');
    for (let i = 0; i < 10; i++) rReliable.reportSuccess(leaseA, 10 + i);
    rReliable.release(leaseA);

    rReliable.noteSeen('5.5.5.5:443', 'test', Date.now());
    const leaseFromReliable = await rReliable.acquire('c2');
    expect(leaseFromReliable.proxyUrl).toBe('4.4.4.4:443');

    const rKnown = new ProxyRegistry(testLogger(), { random: () => 0.99, reliablePickChance: 0.7 });
    rKnown.noteSeen('6.6.6.6:443', 'test', Date.now());
    const leaseB = await rKnown.acquire('c1');
    for (let i = 0; i < 10; i++) rKnown.reportSuccess(leaseB, 10 + i);
    rKnown.release(leaseB);
    rKnown.noteSeen('7.7.7.7:443', 'test', Date.now());

    const leaseFromKnown = await rKnown.acquire('c2');
    expect(leaseFromKnown.proxyUrl).toBe('7.7.7.7:443');
  });

  it('persists and restores entries and queue order (Option A)', async () => {
    const file = tmpFile('persist');
    await statsContext('test_').withStats(async () => {
      const r1 = new ProxyRegistry(testLogger(), { persistencePath: file, random: () => 0 });
      r1.noteSeen('8.8.8.8:443', 'test', Date.now());
      r1.noteSeen('9.9.9.9:443', 'test', Date.now());
      const l = await r1.acquire('c1');
      for (let i = 0; i < 10; i++) r1.reportSuccess(l, 10 + i); // promote first
      r1.release(l);
      await r1.save();

      const r2 = new ProxyRegistry(testLogger(), { persistencePath: file, random: () => 0 });
      await r2.load();
      const lease = await r2.acquire('c2');
      // reliable should be preferred when random picks reliable
      expect(lease.proxyUrl).toBe('8.8.8.8:443');
    });
  });
});
