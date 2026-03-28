import * as path from 'node:path';
import { convert } from '@kreuzberg/html-to-markdown-node';
import { smartSave } from '../lib/smart-save.js';
import type {
  BaseJob,
  BaseStrategy,
  CacheOperations,
  Listing,
  Logger,
  ProcessedJob,
  StrategySaveOptions,
  StrategyStats,
} from '../types/index.js';

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
    const extracted = this.extractContent(content);
    const processedJob: ProcessedJob = {
      ...job,
      strategy_id: this.jobToId(job),
      strategy_url: url,
      strategy_slug: this.slug,
    };

    const id = this.jobToId(job);
    const htmlFilePath = path.join(outDir, this.slug, `${id}.html`);
    await smartSave(htmlFilePath, extracted, false, logger);

    const mdFilePath = path.join(outDir, this.slug, `${id}.md`);
    await smartSave(
      mdFilePath,
      convert(extracted, {
        // @ts-expect-error work around: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
        headingStyle: 'Atx',
        // @ts-expect-error work around: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
        codeBlockStyle: 'Backticks',
        wrap: true,
        wrapWidth: 100,
      }),
      false,
      logger,
    );

    const jsonFilePath = path.join(outDir, this.slug, `${id}.json`);
    return smartSave(jsonFilePath, processedJob, false, logger);
  }
}
