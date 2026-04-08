import * as path from 'node:path';
import { smartSave } from '../../lib/smart-save.js';
import type {
  JobJson,
  Strategy,
  CacheOperations,
  Listing,
  StrategySaveOptions,
  StrategyStats,
} from '../types/index.js';
import fs from 'node:fs/promises';
import { metaSchema, type TMetaSchema } from '../../../schema/schema.meta.js';
import type { ILogger } from '../../lib/logger.js';

function createBaseStats(): StrategyStats {
  return {
    listings_processed: 0,
    job_processed: 0,
    cache_hit: 0,
    cache_miss: 0,
    cache_writes: 0,
    unique: 0,
    writes: 0,
    errors: 0,
  };
}

export abstract class AbstractStrategy implements Strategy {
  readonly slug: string;
  stats: StrategyStats;
  ids: Set<string>;

  protected constructor(slug: string) {
    this.slug = slug;
    this.stats = createBaseStats();
    this.ids = new Set<string>();
  }

  abstract jobListingsGenerator(): AsyncGenerator<Listing>;

  abstract jobGenerator(
    listing: Listing,
    logger: ILogger,
    cache: CacheOperations,
  ): AsyncGenerator<JobJson>;

  abstract jobToUrl(job: JobJson): string;

  abstract jobToId(job: JobJson): string;

  async save(options: StrategySaveOptions): Promise<void> {
    const { outDir, cached, job, url, content, logger } = options;
    const jobId = this.jobToId(job);
    const jobDir = path.join(outDir, `${this.slug}-${jobId}`);

    const meta = metaSchema.parse({
      offer: {
        id: this.jobToId(job),
        url,
        source: this.slug,
        publishedAt: null,
        updatedAt: null,
        expiresAt: null,
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
