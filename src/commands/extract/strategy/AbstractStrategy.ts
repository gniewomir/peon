import * as path from 'node:path';
import { smartSave } from '../../lib/smart-save.js';
import type {
  JobJson,
  JobPageParser,
  Strategy,
  CacheOperations,
  Listing,
  Logger,
  StrategySaveOptions,
  StrategyStats,
} from '../types/index.js';
import fs from 'node:fs/promises';
import type { JobMetadata } from '../../types/Job.js';

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

  protected async readJsonFile<T extends object = Record<string, unknown>>(
    filePath: string,
  ): Promise<T> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (cause) {
      throw new Error(`Failed to read/parse JSON file at "${filePath}"`, { cause });
    }
  }

  abstract jobListingsGenerator(): AsyncGenerator<Listing>;

  abstract jobGenerator(
    listing: Listing,
    logger: Logger,
    cache: CacheOperations,
  ): AsyncGenerator<JobJson>;

  abstract jobToUrl(job: JobJson): string;

  abstract jobToId(job: JobJson): string;

  protected abstract get jobPageParser(): JobPageParser;

  jobContent(content: string): string {
    return this.jobPageParser.extract(content);
  }

  async save(options: StrategySaveOptions): Promise<JobMetadata> {
    const { outDir, cached, job, url, content, logger } = options;
    const jobId = this.jobToId(job);
    const jobDir = path.join(outDir, `${this.slug}-${jobId}`);

    const metadata: JobMetadata = {
      strategy_slug: this.slug,
      job_id: this.jobToId(job),
      job_url: url,
      job_staging_dir: jobDir,
      files: {
        job_cache: cached,
        job_meta: path.join(jobDir, `meta.json`),
        job_json: path.join(jobDir, `job.json`),
        job_html: path.join(jobDir, `job.html`),
        job_markdown: path.join(jobDir, `job.md`),
        job_clean_json: path.join(jobDir, `job.clean.json`),
        job_clean_normalized_json: path.join(jobDir, `job.normalized.json`),
        job_interrogated_json: path.join(jobDir, `job.interrogated.json`),
        job_interrogated_normalized_json: path.join(jobDir, `job.interrogated.normalized.json`),
        job_combined_json: path.join(jobDir, `job.combined.json`),
      },
    };

    await fs.mkdir(jobDir, { recursive: true });

    const html = this.jobContent(content);

    await smartSave(metadata.files.job_meta, metadata, false, logger);

    await Promise.all([
      smartSave(metadata.files.job_json, job, false, logger),
      smartSave(metadata.files.job_html, html, false, logger),
    ]);

    return metadata;
  }
}
