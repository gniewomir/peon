import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';

import type { Logger } from '../../../../lib/logger.js';
import type { ShutdownContext } from '../../../../lib/shutdown.js';
import { atomicWrite } from '../../../../lib/atomicWrite.js';
import { rootPath } from '../../../../lib/root.js';
import { LinkedList } from '../../../transform/lib/LinkedList.js';
import { findProxies } from './proxy-scraper.js';

export type ProxyStatus = 'known' | 'reliable' | 'trash';

export type ProxyKey = string;

export interface Lease {
  leaseId: string;
  consumerId: string;
  proxyKey: ProxyKey;
  proxyUrl: string;
}

export interface ProxyEntrySerializable {
  key: ProxyKey;
  status: ProxyStatus;
  currentStreak: number;
  bestStreak: number;
  failedAtFirstAttemptCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastUsedAt: number | null;
  source: string | null;
}

export interface ProxyRegistrySerializable {
  version: 1;
  savedAt: number;
  entries: Record<ProxyKey, ProxyEntrySerializable>;
  queues: {
    reliable: ProxyKey[];
    known: ProxyKey[];
    trash: ProxyKey[];
  };
}

type ProxyEntry = {
  key: ProxyKey;
  status: ProxyStatus;
  currentStreak: number;
  bestStreak: number;
  failedAtFirstAttemptCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastUsedAt: number | null;
  source: string | null;
  leasedBy: string | null;
  leasedAt: number | null;
};

export type ProxyRegistryOptions = {
  persistencePath?: string;
  saveEveryMs?: number;
  knownOrTrashStaleAfterMs?: number;
  reliablePickChance?: number;
  random?: () => number;
};

const DEFAULT_SAVE_EVERY_MS = 10 * 60 * 1000;
const DEFAULT_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_RELIABLE_PICK_CHANCE = 0.7;

function defaultPersistencePath(): string {
  return path.join(rootPath(), 'data', 'proxy-registry.json');
}

function nowMs(): number {
  return Date.now();
}

function stableNow(v?: number): number {
  return typeof v === 'number' ? v : nowMs();
}

export class ProxyRegistry {
  private readonly entries = new Map<ProxyKey, ProxyEntry>();
  private readonly reliableQ = new LinkedList<ProxyEntry>();
  private readonly knownQ = new LinkedList<ProxyEntry>();
  private readonly trashQ = new LinkedList<ProxyEntry>();

  private readonly persistencePath: string;
  private readonly saveEveryMs: number;
  private readonly knownOrTrashStaleAfterMs: number;
  private readonly reliablePickChance: number;
  private readonly random: () => number;

  private inFlightRefill: Promise<void> | null = null;
  private persistenceTimer: NodeJS.Timeout | null = null;
  private shutdownCleanupRegistered = false;

  constructor(
    private readonly logger: Logger,
    options: ProxyRegistryOptions = {},
  ) {
    this.persistencePath = options.persistencePath ?? defaultPersistencePath();
    this.saveEveryMs = options.saveEveryMs ?? DEFAULT_SAVE_EVERY_MS;
    this.knownOrTrashStaleAfterMs = options.knownOrTrashStaleAfterMs ?? DEFAULT_STALE_AFTER_MS;
    this.reliablePickChance = options.reliablePickChance ?? DEFAULT_RELIABLE_PICK_CHANCE;
    this.random = options.random ?? Math.random;
  }

  registerPersistence(shutdownCtx?: ShutdownContext): void {
    if (!this.persistenceTimer) {
      this.persistenceTimer = setInterval(() => {
        void this.save().catch((err) => {
          this.logger.error(` ⚠️  Proxy registry save failed: ${(err as Error).message}`);
        });
      }, this.saveEveryMs);
      // Let the process exit naturally.
      this.persistenceTimer.unref?.();
    }

    if (shutdownCtx && !this.shutdownCleanupRegistered) {
      this.shutdownCleanupRegistered = true;
      shutdownCtx.registerCleanup(async () => {
        await this.save();
      });
    }
  }

  async load(): Promise<void> {
    let raw: string;
    try {
      raw = await fs.readFile(this.persistencePath, 'utf8');
    } catch {
      return;
    }

    let parsed: ProxyRegistrySerializable;
    try {
      parsed = JSON.parse(raw) as ProxyRegistrySerializable;
    } catch (err) {
      this.logger.warn(` ⚠️  Proxy registry load failed (invalid JSON): ${(err as Error).message}`);
      return;
    }

    if (!parsed || parsed.version !== 1 || typeof parsed.entries !== 'object' || !parsed.queues) {
      this.logger.warn(' ⚠️  Proxy registry load failed (unexpected schema).');
      return;
    }

    this.entries.clear();
    // Clear queues by re-instantiating via shifts
    for (let v = this.reliableQ.shift(); v !== undefined; v = this.reliableQ.shift()) void v;
    for (let v = this.knownQ.shift(); v !== undefined; v = this.knownQ.shift()) void v;
    for (let v = this.trashQ.shift(); v !== undefined; v = this.trashQ.shift()) void v;

    for (const [key, entry] of Object.entries(parsed.entries)) {
      if (!entry || entry.key !== key) continue;
      const e: ProxyEntry = {
        key,
        status: entry.status,
        currentStreak: entry.currentStreak,
        bestStreak: entry.bestStreak,
        failedAtFirstAttemptCount: entry.failedAtFirstAttemptCount,
        firstSeenAt: entry.firstSeenAt,
        lastSeenAt: entry.lastSeenAt,
        lastUsedAt: entry.lastUsedAt,
        source: entry.source,
        leasedBy: null,
        leasedAt: null,
      };
      this.entries.set(key, e);
    }

    const seenInQueues = new Set<ProxyKey>();
    const enqueueKeys = (keys: ProxyKey[], queue: LinkedList<ProxyEntry>) => {
      for (const k of keys) {
        if (seenInQueues.has(k)) continue;
        const entry = this.entries.get(k);
        if (!entry) continue;
        seenInQueues.add(k);
        queue.append(entry);
      }
    };

    enqueueKeys(parsed.queues.reliable ?? [], this.reliableQ);
    enqueueKeys(parsed.queues.known ?? [], this.knownQ);
    enqueueKeys(parsed.queues.trash ?? [], this.trashQ);

    // Ensure every entry exists in exactly one queue (status is source of truth).
    for (const entry of this.entries.values()) {
      if (seenInQueues.has(entry.key)) continue;
      this.queueByStatus(entry).append(entry);
      seenInQueues.add(entry.key);
    }

    // Fix mismatched status vs queue (best-effort):
    // remove-from-all then enqueue by status.
    for (const entry of this.entries.values()) {
      this.removeFromAllQueues(entry);
      this.queueByStatus(entry).append(entry);
    }

    this.logger.log(` ✅ Loaded proxy registry (${this.entries.size} entries).`);
  }

  async save(): Promise<void> {
    const serialized: ProxyRegistrySerializable = {
      version: 1,
      savedAt: nowMs(),
      entries: {},
      queues: {
        reliable: [],
        known: [],
        trash: [],
      },
    };

    for (const entry of this.entries.values()) {
      serialized.entries[entry.key] = {
        key: entry.key,
        status: entry.status,
        currentStreak: entry.currentStreak,
        bestStreak: entry.bestStreak,
        failedAtFirstAttemptCount: entry.failedAtFirstAttemptCount,
        firstSeenAt: entry.firstSeenAt,
        lastSeenAt: entry.lastSeenAt,
        lastUsedAt: entry.lastUsedAt,
        source: entry.source,
      };
    }

    serialized.queues.reliable = this.reliableQ.toArray().map((e) => e.key);
    serialized.queues.known = this.knownQ.toArray().map((e) => e.key);
    serialized.queues.trash = this.trashQ.toArray().map((e) => e.key);

    await atomicWrite(this.persistencePath, serialized, this.logger);
  }

  async acquire(consumerId: string): Promise<Lease> {
    const leaseId = randomUUID();

    const pickQueue = (): LinkedList<ProxyEntry> => {
      const hasReliable = this.reliableQ.size > 0;
      const hasKnown = this.knownQ.size > 0;
      if (hasReliable && hasKnown) {
        return this.random() < this.reliablePickChance ? this.reliableQ : this.knownQ;
      }
      if (hasReliable) return this.reliableQ;
      return this.knownQ;
    };

    let attempts = 0;
    while (true) {
      const first = pickQueue();
      const second = first === this.reliableQ ? this.knownQ : this.reliableQ;
      const picked = this.shiftEligible(first) ?? this.shiftEligible(second);
      if (picked) {
        picked.leasedBy = consumerId;
        picked.leasedAt = nowMs();
        picked.lastUsedAt = picked.lastUsedAt ?? nowMs();
        return {
          leaseId,
          consumerId,
          proxyKey: picked.key,
          proxyUrl: picked.key,
        };
      }

      // No available candidates. Attempt refill once, then retry.
      if (attempts >= 1) {
        throw new Error(' ⚠️  No proxy available - terminating');
      }
      attempts += 1;
      await this.refillKnown();
    }
  }

  reportSuccess(lease: Lease, at?: number): void {
    const entry = this.mustGetEntry(lease.proxyKey);
    entry.failedAtFirstAttemptCount = 0;
    entry.lastUsedAt = stableNow(at);
    entry.currentStreak += 1;
    entry.bestStreak = Math.max(entry.bestStreak, entry.currentStreak);
    if (entry.status !== 'reliable' && entry.bestStreak >= 10) {
      entry.status = 'reliable';
      this.moveToStatusQueue(entry);
    }
  }

  reportFailure(lease: Lease, at?: number): void {
    const entry = this.mustGetEntry(lease.proxyKey);
    const ts = stableNow(at);
    entry.lastUsedAt = ts;
    if (entry.currentStreak === 0) {
      entry.failedAtFirstAttemptCount += 1;
    }
    entry.currentStreak = 0;
    if (entry.failedAtFirstAttemptCount >= 3 && entry.status !== 'trash') {
      entry.status = 'trash';
      this.moveToStatusQueue(entry);
    }
  }

  release(lease: Lease): void {
    const entry = this.mustGetEntry(lease.proxyKey);
    if (entry.leasedBy !== lease.consumerId) {
      return;
    }
    entry.leasedBy = null;
    entry.leasedAt = null;

    if (this.isStaleAndEvictable(entry, nowMs())) {
      this.removeFromAllQueues(entry);
      this.entries.delete(entry.key);
      return;
    }

    // Requeue to current status to preserve FIFO cycling.
    this.moveToStatusQueue(entry);
  }

  noteSeen(proxyKey: ProxyKey, source: string | null, at?: number): void {
    const ts = stableNow(at);
    const existing = this.entries.get(proxyKey);
    if (existing) {
      existing.lastSeenAt = ts;
      if (existing.source === null) existing.source = source;
      return;
    }

    const entry: ProxyEntry = {
      key: proxyKey,
      status: 'known',
      currentStreak: 0,
      bestStreak: 0,
      failedAtFirstAttemptCount: 0,
      firstSeenAt: ts,
      lastSeenAt: ts,
      lastUsedAt: null,
      source,
      leasedBy: null,
      leasedAt: null,
    };
    this.entries.set(proxyKey, entry);
    this.knownQ.append(entry);
  }

  private mustGetEntry(key: ProxyKey): ProxyEntry {
    const entry = this.entries.get(key);
    if (!entry) {
      throw new Error(`Proxy entry not found for key ${key}`);
    }
    return entry;
  }

  private queueByStatus(entry: ProxyEntry): LinkedList<ProxyEntry> {
    if (entry.status === 'reliable') return this.reliableQ;
    if (entry.status === 'trash') return this.trashQ;
    return this.knownQ;
  }

  private removeFromAllQueues(entry: ProxyEntry): void {
    this.reliableQ.remove(entry);
    this.knownQ.remove(entry);
    this.trashQ.remove(entry);
  }

  private moveToStatusQueue(entry: ProxyEntry): void {
    this.removeFromAllQueues(entry);
    this.queueByStatus(entry).append(entry);
  }

  private shiftEligible(queue: LinkedList<ProxyEntry>): ProxyEntry | null {
    const ts = nowMs();
    // Bound the scan to avoid infinite loops when all entries are leased.
    const scanLimit = queue.size;
    for (let i = 0; i < scanLimit; i++) {
      const entry = queue.shift();
      if (!entry) return null;

      // Lazily evict stale known/trash entries.
      if (this.isStaleAndEvictable(entry, ts)) {
        this.entries.delete(entry.key);
        continue;
      }

      // Never select trash.
      if (entry.status === 'trash') {
        this.trashQ.append(entry);
        continue;
      }

      // Skip leased entries (put back to tail).
      if (entry.leasedBy) {
        queue.append(entry);
        continue;
      }

      // Found candidate: re-append it to preserve FIFO order for next time,
      // but lease holder will keep it; other consumers will skip due to leasedBy.
      queue.append(entry);
      return entry;
    }
    return null;
  }

  private isStaleAndEvictable(entry: ProxyEntry, ts: number): boolean {
    if (entry.status === 'reliable') return false;
    const lastTouch = Math.max(entry.lastSeenAt, entry.lastUsedAt ?? 0);
    return lastTouch > 0 && ts - lastTouch >= this.knownOrTrashStaleAfterMs;
  }

  private async refillKnown(): Promise<void> {
    if (this.inFlightRefill) {
      return this.inFlightRefill;
    }
    this.inFlightRefill = (async () => {
      const proxies = await findProxies(this.logger);
      proxies.forEach((p) => {
        const key = p.trim();
        if (!key) return;
        this.noteSeen(key, 'scrape', nowMs());
      });
    })().finally(() => {
      this.inFlightRefill = null;
    });
    return this.inFlightRefill;
  }
}
