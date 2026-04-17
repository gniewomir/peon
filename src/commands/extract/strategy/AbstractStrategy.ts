import * as path from 'node:path';
import { atomicWrite } from '../../../lib/atomicWrite.js';
import { atomicMoveDir } from '../../../lib/atomicMoveDir.js';
import fs from 'node:fs/promises';
import { metaSchema, nullMetaSchema, type TMetaSchema } from '../../../schema/schema.meta.js';
import type { Logger } from '../../../lib/logger.js';
import type {
  Strategy,
  StrategyOptions,
  StrategyParameters,
  StrategySaveOptions,
} from './types.js';
import type { ItemJson, Listing } from '../types.js';
import type { CacheOperations } from '../lib/cache.js';
import type { KnownStrategy } from '../../../lib/types.js';
import type { GoToOptions } from 'puppeteer-core';
import { artifactFilename, KnownArtifactsEnum } from '../../../lib/artifacts.js';
import { access } from 'fs/promises';
import { constants } from 'node:fs';
import { statsAddToCounter } from '../../../lib/stats.js';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LRUHashMap } from '../../transform/lib/LRUHashMap.js';

export abstract class AbstractStrategy implements Strategy {
  public abstract readonly slug: KnownStrategy;
  protected readonly logger: Logger;
  protected readonly options: StrategyOptions;
  protected ids: Set<string>;
  protected seen: LRUHashMap<string> = new LRUHashMap<string>(50_000);

  public constructor({ logger, options }: StrategyParameters) {
    this.logger = logger;
    this.options = {
      ...options,
    };
    this.ids = new Set<string>();
  }

  public pageOpenOptions(): GoToOptions {
    return this.options.pageOpenOptions;
  }

  public cacheScope(): StrategyOptions['cache'] {
    return this.options.cache;
  }

  protected addSeen(id: string): void {
    this.seen.set(id, id);
  }

  protected hasSeen(id: string): boolean {
    return this.seen.has(id);
  }

  protected resetSeen(): void {
    for (const key in this.seen) {
      this.seen.delete(key);
    }
  }

  abstract listingGenerator(): AsyncGenerator<Listing>;

  abstract itemGenerator(listing: Listing, cache: CacheOperations): AsyncGenerator<ItemJson>;

  abstract itemToUrl(job: ItemJson): string;

  abstract itemToId(job: ItemJson): string;

  async save({ cachePath, json, url, html }: StrategySaveOptions): Promise<void> {
    const itemId = this.itemToId(json);
    const itemDirName = `${this.slug}-${itemId}`;
    const itemStagingDir = path.join(this.options.stagingDir, itemDirName);
    const itemQuarantineDir = path.join(this.options.quarantineDir, itemDirName);
    const itemTrashDir = path.join(this.options.trashDir, itemDirName);
    const itemLoadDir = path.join(this.options.loadDir, itemDirName);
    const dataDirectory = dirname(dirname(itemStagingDir));
    const itemTmpDir = path.join(
      dataDirectory,
      'tmp',
      `.${itemDirName}.tmp-${process.pid}-${randomUUID()}`,
    );

    // If item is staged, then we still processing it,
    // no point in triggering pipeline again until we decide fate of last payload
    if (await this.pathExists(itemStagingDir)) {
      statsAddToCounter('item_already_staged');
      statsAddToCounter(`item_already_staged_${this.slug}`);
      this.logger.debug(`item ${itemId} already staged`);
      return;
    }

    // If job is trashed, then we do not want to process it at all
    if (await this.pathExists(itemTrashDir)) {
      statsAddToCounter('item_already_trashed');
      statsAddToCounter(`item_already_trashed_${this.slug}`);
      this.logger.debug(`item ${itemId} already trashed`);
      return;
    }

    // If job is quarantined, then we do not want to stage it again until issue is investigated and resolved
    if (await this.pathExists(itemQuarantineDir)) {
      statsAddToCounter('item_already_quarantined');
      statsAddToCounter(`item_already_quarantined_${this.slug}`);
      this.logger.debug(`item ${itemId} was quarantined`);
      return;
    }

    // If job is loaded but not yet removed by consumer do not stage it again yet
    if (await this.pathExists(itemLoadDir)) {
      statsAddToCounter('item_already_loaded');
      statsAddToCounter(`item_already_loaded_${this.slug}`);
      this.logger.debug(
        `job ${itemId} was loaded (but not yet removed from load directory, skipping)`,
      );
      return;
    }

    const meta = metaSchema.parse({
      ...nullMetaSchema(),
      offer: {
        ...nullMetaSchema().offer,
        id: this.itemToId(json),
        url,
        source: this.slug,
        cachePath,
        stagingPath: itemStagingDir,
      },
    } satisfies TMetaSchema);

    return fs
      .mkdir(itemTmpDir, { recursive: true })
      .then(() => fs.mkdir(dirname(itemStagingDir), { recursive: true }))
      .then(() =>
        Promise.all([
          atomicWrite(
            path.join(itemTmpDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_META)),
            meta,
            this.logger,
          ),
          atomicWrite(
            path.join(itemTmpDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_JSON)),
            json,
            this.logger,
          ),
          atomicWrite(
            path.join(itemTmpDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_HTML)),
            html,
            this.logger,
          ),
        ]),
      )
      .then(() => atomicMoveDir(itemTmpDir, itemStagingDir, this.logger))
      .then(() => {
        statsAddToCounter('item_staged');
        statsAddToCounter(`item_staged_${this.slug}`);
      });
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
