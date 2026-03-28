import * as path from 'node:path';
import { convert } from '@kreuzberg/html-to-markdown-node';
import { smartSave } from '../lib/smart-save.js';
import type {
  BaseJob,
  BaseStrategy,
  CacheOperations,
  Listing,
  Logger,
  StrategySaveOptions,
  StrategyStats,
} from '../types/index.js';
import fs from 'node:fs/promises';

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

export abstract class AbstractStrategy implements BaseStrategy {
  readonly slug: string;
  stats: StrategyStats;
  ids: Set<string>;

  protected constructor(slug: string) {
    this.slug = slug;
    this.stats = createBaseStats();
    this.ids = new Set<string>();
  }

  abstract listingsGenerator(): AsyncGenerator<Listing>;

  abstract jobGenerator(
    listing: Listing,
    logger: Logger,
    cache: CacheOperations,
  ): AsyncGenerator<BaseJob>;

  abstract jobToUrl(job: BaseJob): string;

  abstract jobToId(job: BaseJob): string;

  abstract extractContent(content: string): string;

  async save(options: StrategySaveOptions<BaseJob>): Promise<number> {
    const { outDir, job, url, content, logger } = options;
    const jobId = this.jobToId(job);
    const jobDir = path.join(outDir, this.slug, jobId);

    const metadata = {
      strategy_id: this.jobToId(job),
      strategy_url: url,
      strategy_slug: this.slug,
      files: {
        meta: path.join(jobDir, `meta.json`),
        json: path.join(jobDir, `${this.jobToId(job)}.json`),
        html: path.join(jobDir, `${this.jobToId(job)}.html`),
        md: path.join(jobDir, `${this.jobToId(job)}.md`),
      },
    };

    await fs.mkdir(jobDir, { recursive: true });

    const extracted = this.extractContent(content);
    const markdown = convert(extracted, {
      // @ts-expect-error work around: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
      headingStyle: 'Atx',
      // @ts-expect-error work around: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
      codeBlockStyle: 'Backticks',
      wrap: true,
      wrapWidth: 100,
    });

    await Promise.all([
      smartSave(metadata.files.meta, metadata, false, logger),
      smartSave(metadata.files.json, job, false, logger),
      smartSave(metadata.files.html, extracted, false, logger),
      smartSave(metadata.files.md, markdown, false, logger),
    ]);

    return 1;
  }
}
