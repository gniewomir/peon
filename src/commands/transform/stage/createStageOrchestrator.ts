import { CleanJsonStage } from './stage-clean-job-json/CleanJsonStage.js';
import { HtmlToMdStage } from './stage-html-to-md/HtmlToMdStage.js';
import { LlmStage } from './stage-llm/LlmStage.js';
import { CleanHtmlStage } from './stage-clean-html/CleanHtmlStage.js';
import { StageOrchestrator } from './StageOrchestrator.js';
import type { Logger } from '../../lib/logger.js';
import { HtmlToJsonStage } from './stage-html-to-json/HtmlToJsonStage.js';
import { CleanMetaStage } from './stage-clean-meta/CleanMetaStage.js';

export function createStageOrchestrator({
  logger,
  stagingDir,
}: {
  logger: Logger;
  stagingDir: string;
}): StageOrchestrator {
  const registry = new StageOrchestrator({ logger, stagingDir });
  registry.register(
    new HtmlToJsonStage({
      logger,
      stagingDir,
      transformations: HtmlToJsonStage.transformations(),
    }),
  );
  registry.register(
    new CleanMetaStage({
      logger,
      stagingDir,
      transformations: CleanMetaStage.transformations(),
    }),
  );
  registry.register(
    new CleanJsonStage({
      logger,
      stagingDir,
      transformations: CleanJsonStage.transformations(),
    }),
  );
  registry.register(
    new CleanHtmlStage({
      logger,
      stagingDir,
      transformations: CleanHtmlStage.transformations(),
    }),
  );
  registry.register(
    new HtmlToMdStage({
      logger,
      stagingDir,
      transformations: HtmlToMdStage.transformations(),
    }),
  );
  registry.register(
    new LlmStage({
      logger,
      stagingDir,
      transformations: LlmStage.transformations(),
    }),
  );
  return registry;
}
