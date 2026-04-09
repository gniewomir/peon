import { CleanJsonStage } from '../stage-clean-job-json/CleanJsonStage.js';
import { CleanerBdj } from '../stage-clean-job-json/CleanerBdj.js';
import { CleanerJji } from '../stage-clean-job-json/CleanerJji.js';
import { CleanerNfj } from '../stage-clean-job-json/CleanerNfj.js';
import { HtmlToMdStage } from '../stage-html-to-md/HtmlToMdStage.js';
import { LlmStage } from '../stage-llm/LlmStage.js';
import { HtmlCleanerBdj } from '../stage-clean-html/HtmlCleanerBdj.js';
import { HtmlCleanerJji } from '../stage-clean-html/HtmlCleanerJji.js';
import { HtmlCleanerNfj } from '../stage-clean-html/HtmlCleanerNfj.js';
import { CleanHtmlStage } from '../stage-clean-html/CleanHtmlStage.js';
import { StageOrchestrator } from './StageOrchestrator.js';
import type { ILogger } from '../../../lib/logger.js';
import { HtmlToJsonStage } from '../stage-json-from-html/HtmlToJsonStage.js';
import { HtmlToJsonExtractorNfj } from '../stage-json-from-html/HtmlToJsonExtractorNfj.js';
import { HtmlToJsonExtractorBdj } from '../stage-json-from-html/HtmlToJsonExtractorBdj.js';
import { HtmlToJsonExtractorJji } from '../stage-json-from-html/HtmlToJsonExtractorJji.js';

export function createStageOrchestrator({
  logger,
  stagingDir,
}: {
  logger: ILogger;
  stagingDir: string;
}): StageOrchestrator {
  const registry = new StageOrchestrator({ logger, stagingDir });
  registry.register(
    new HtmlToJsonStage({
      logger,
      stagingDir,
      extractors: [
        new HtmlToJsonExtractorJji(),
        new HtmlToJsonExtractorBdj(),
        new HtmlToJsonExtractorNfj(),
      ],
    }),
  );
  registry.register(
    new CleanJsonStage({
      logger,
      stagingDir,
      cleaners: [new CleanerJji(), new CleanerNfj(), new CleanerBdj()],
    }),
  );
  registry.register(
    new CleanHtmlStage({
      logger,
      stagingDir,
      cleaners: [new HtmlCleanerJji(), new HtmlCleanerNfj(), new HtmlCleanerBdj()],
    }),
  );
  registry.register(
    new HtmlToMdStage({
      logger,
      stagingDir,
    }),
  );
  registry.register(
    new LlmStage({
      logger,
      stagingDir,
    }),
  );
  return registry;
}
