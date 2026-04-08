import { AbstractStage } from '../lib.stage/AbstractStage.js';
import type { AbstractGuard } from '../lib.guard/AbstractGuard.js';
import type { StagingFileEvent } from '../../types.js';
import type { ILogger } from '../../../lib/logger.js';
import type { AbstractHtmlToJsonExtractor } from './AbstractHtmlToJsonExtractor.js';
import path, { dirname } from 'node:path';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { NotEmptyGuard } from '../lib.guard/NotEmptyGuard.js';

export class HtmlToJsonStage extends AbstractStage {
  private readonly extractors = new Map<string, AbstractHtmlToJsonExtractor>();

  constructor({
    logger,
    stagingDir,
    extractors,
  }: {
    logger: ILogger;
    stagingDir: string;
    extractors: AbstractHtmlToJsonExtractor[];
  }) {
    super({ logger, stagingDir });
    for (const extractor of extractors) {
      this.extractors.set(extractor.strategy(), extractor);
    }
  }

  name(): string {
    return 'html-to-json';
  }

  protected inputFiles(): string[] {
    return ['raw.job.html'];
  }

  protected outputFile(): string {
    return 'html.json';
  }

  protected guards(): AbstractGuard[] {
    return [new NotEmptyGuard()];
  }

  protected async payload(
    event: StagingFileEvent,
  ): Promise<string | Record<string, unknown> | unknown[]> {
    const jobDir = dirname(event.payload);
    const input = await readFile(path.join(jobDir, this.inputFiles()[0]), 'utf8');
    const meta = await this.readMetadata(jobDir);
    const source = meta.offer.source;
    assert(source !== null, 'unknown offer source');
    const extractor = this.extractors.get(source);
    assert(extractor, `no json extractor registered for source "${source}"`);
    return extractor.extract(input);
  }
}
