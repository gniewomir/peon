import * as path from 'node:path';
import { smartSave } from '../../lib/smartSave.js';
import fs from 'node:fs/promises';
import { metaSchema, nullMetaSchema, type TMetaSchema } from '../../../schema/schema.meta.js';
import type { Logger } from '../../lib/logger.js';
import type {
  Strategy,
  StrategyOptions,
  StrategyParameters,
  StrategySaveOptions,
} from './types.js';
import type { JobJson, Listing } from '../types.js';
import type { CacheOperations } from '../lib/cache.js';
import type { KnownStrategy } from '../../../lib/types.js';
import type { GoToOptions } from 'puppeteer-core';
import { artifactFilename, KnownArtifactsEnum } from '../../../lib/artifacts.js';

export abstract class AbstractStrategy implements Strategy {
  public abstract readonly slug: KnownStrategy;
  protected readonly logger: Logger;
  protected readonly options: StrategyOptions;
  protected ids: Set<string>;

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

  abstract jobListingsGenerator(): AsyncGenerator<Listing>;

  abstract jobGenerator(listing: Listing, cache: CacheOperations): AsyncGenerator<JobJson>;

  abstract jobToUrl(job: JobJson): string;

  abstract jobToId(job: JobJson): string;

  async save({ cachePath, json, url, html }: StrategySaveOptions): Promise<void> {
    const jobId = this.jobToId(json);
    const jobStagingDir = path.join(this.options.stagingDir, `${this.slug}-${jobId}`);

    const meta = metaSchema.parse({
      ...nullMetaSchema(),
      offer: {
        ...nullMetaSchema().offer,
        id: this.jobToId(json),
        url,
        source: this.slug,
        cachePath,
        stagingPath: jobStagingDir,
      },
    } satisfies TMetaSchema);

    await fs.mkdir(jobStagingDir, { recursive: true });
    await Promise.all([
      smartSave(
        path.join(jobStagingDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_META_JSON)),
        meta,
        false,
        this.logger,
      ),
      smartSave(
        path.join(jobStagingDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_JSON)),
        json,
        false,
        this.logger,
      ),
      smartSave(
        path.join(jobStagingDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_HTML)),
        html,
        false,
        this.logger,
      ),
    ]);
  }
}
