import * as path from 'node:path';
import { smartSave } from '../../lib/smartSave.js';
import fs from 'node:fs/promises';
import { metaSchema, nullMetaSchema, type TMetaSchema } from '../../../schema/schema.meta.js';
import type { Logger } from '../../lib/logger.js';
import type { Strategy, StrategySaveOptions } from './types.js';
import type { JobJson, Listing } from '../types.js';
import type { CacheOperations } from '../lib/cache.js';
import type { KnownStrategy } from '../../../lib/types.js';
import type { GoToOptions } from 'puppeteer-core';

export abstract class AbstractStrategy implements Strategy {
  public abstract readonly slug: KnownStrategy;
  private readonly logger: Logger;
  ids: Set<string>;

  protected constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
    this.ids = new Set<string>();
  }

  abstract jobListingsGenerator(): AsyncGenerator<Listing>;

  abstract jobGenerator(
    listing: Listing,
    logger: Logger,
    cache: CacheOperations,
  ): AsyncGenerator<JobJson>;

  abstract pageOpenOptions(): GoToOptions;

  abstract jobToUrl(job: JobJson): string;

  abstract jobToId(job: JobJson): string;

  async save(options: StrategySaveOptions): Promise<void> {
    const { outDir, cached, job, url, content, logger } = options;
    const jobId = this.jobToId(job);
    const jobDir = path.join(outDir, `${this.slug}-${jobId}`);

    const meta = metaSchema.parse({
      ...nullMetaSchema(),
      offer: {
        ...nullMetaSchema().offer,
        id: this.jobToId(job),
        url,
        source: this.slug,
        cachePath: cached,
        stagingPath: jobDir,
      },
    } satisfies TMetaSchema);

    await fs.mkdir(jobDir, { recursive: true });
    await Promise.all([
      smartSave(path.join(jobDir, `raw.meta.json`), meta, false, logger),
      smartSave(path.join(jobDir, `raw.job.json`), job, false, logger),
      smartSave(path.join(jobDir, `raw.job.html`), content, false, logger),
    ]);
  }
}
