import { CleanCombineStage } from './stage-clean-combine/CleanCombineStage.js';
import { CleanHtmlToMdStage } from './stage-clean-html-to-md/CleanHtmlToMdStage.js';
import { CleanHtmlStage } from './stage-clean-html/CleanHtmlStage.js';
import { CleanMetaStage } from './stage-clean-meta/CleanMetaStage.js';
import { CleanHtmlJsonStage } from './stage-clean-html-json/CleanHtmlJsonStage.js';
import { CleanHtmlToJsonStage } from './stage-clean-html-to-json/CleanHtmlToJsonStage.js';
import { CleanJsonStage } from './stage-clean-job-json/CleanJsonStage.js';
import type { Logger } from '../../../lib/logger.js';

export function createStages({
  logger,
  stagingDir,
  trashDir,
  loadDir,
}: {
  logger: Logger;
  stagingDir: string;
  trashDir: string;
  loadDir: string;
}) {
  return [
    new CleanJsonStage({
      logger,
      stagingDir,
      trashDir,
      loadDir,
      transformations: CleanJsonStage.transformations(),
    }),
    new CleanHtmlToJsonStage({
      logger,
      stagingDir,
      trashDir,
      loadDir,
      transformations: CleanHtmlToJsonStage.transformations(),
    }),
    new CleanHtmlJsonStage({
      logger,
      stagingDir,
      trashDir,
      loadDir,
      transformations: CleanHtmlJsonStage.transformations(),
    }),
    new CleanMetaStage({
      logger,
      stagingDir,
      trashDir,
      loadDir,
      transformations: CleanMetaStage.transformations(),
    }),
    new CleanHtmlStage({
      logger,
      stagingDir,
      trashDir,
      loadDir,
      transformations: CleanHtmlStage.transformations(),
    }),
    new CleanHtmlToMdStage({
      logger,
      stagingDir,
      trashDir,
      loadDir,
      transformations: CleanHtmlToMdStage.transformations(),
    }),
    new CleanCombineStage({
      logger,
      stagingDir,
      trashDir,
      loadDir,
      transformations: CleanCombineStage.transformations(),
    }),
  ];
}
