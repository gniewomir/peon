import { CleanCombineStage } from './clean-combine/CleanCombineStage.js';
import { CleanHtmlToMdStage } from './clean-html-to-md/CleanHtmlToMdStage.js';
import { CleanHtmlStage } from './clean-html/CleanHtmlStage.js';
import { CleanMetaStage } from './clean-meta/CleanMetaStage.js';
import { CleanHtmlJsonStage } from './clean-html-json/CleanHtmlJsonStage.js';
import { CleanHtmlToJsonStage } from './clean-html-to-json/CleanHtmlToJsonStage.js';
import { CleanJsonStage } from './clean-job-json/CleanJsonStage.js';
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
