import { CleanJsonStage } from '../stage-clean-json/CleanJsonStage.js';
import { CleanerBdj } from '../stage-clean-json/CleanerBdj.js';
import { CleanerJji } from '../stage-clean-json/CleanerJji.js';
import { CleanerNfj } from '../stage-clean-json/CleanerNfj.js';
import { HtmlToMdStage } from '../stage-html-to-md/HtmlToMdStage.js';
import { LlmStage } from '../stage-llm/LlmStage.js';
import { HtmlCleanerBdj } from '../stage-clean-html/HtmlCleanerBdj.js';
import { HtmlCleanerJji } from '../stage-clean-html/HtmlCleanerJji.js';
import { HtmlCleanerNfj } from '../stage-clean-html/HtmlCleanerNfj.js';
import { CleanHtmlStage } from '../stage-clean-html/CleanHtmlStage.js';
import { StageRegistry } from './StageRegistry.js';
import type { Logger } from '../../../lib/logger.js';

export function createStageRegistry({
  logger,
  stagingDir,
}: {
  logger: Logger;
  stagingDir: string;
}): StageRegistry {
  const registry = new StageRegistry();
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
