import { CleanJsonStage } from './clean-json/CleanJsonStage.js';
import type { Logger } from '../../types/Logger.js';
import { CleanerBdj } from './clean-json/CleanerBdj.js';
import { CleanerJji } from './clean-json/CleanerJji.js';
import { CleanerNfj } from './clean-json/CleanerNfj.js';
import { HtmlToMdStage } from './html-to-md/HtmlToMdStage.js';
import { InterrogateStage } from './interrogate/InterrogateStage.js';
import { JsonPreparerBdj } from './prepare-json/JsonPreparerBdj.js';
import { JsonPreparerJji } from './prepare-json/JsonPreparerJji.js';
import { JsonPreparerNfj } from './prepare-json/JsonPreparerNfj.js';
import { PrepareJsonStage } from './prepare-json/PrepareJsonStage.js';
import { HtmlPreparerBdj } from './prepare-html/HtmlPreparerBdj.js';
import { HtmlPreparerJji } from './prepare-html/HtmlPreparerJji.js';
import { HtmlPreparerNfj } from './prepare-html/HtmlPreparerNfj.js';
import { PrepareHtmlStage } from './prepare-html/PrepareHtmlStage.js';
import { StagesRegistry } from './StagesRegistry.js';

export function createRegistry({
  logger,
  stagingDir,
}: {
  logger: Logger;
  stagingDir: string;
}): StagesRegistry {
  const registry = new StagesRegistry();
  registry.register(
    new PrepareJsonStage({
      logger,
      stagingDir,
      preparers: [new JsonPreparerJji(), new JsonPreparerNfj(), new JsonPreparerBdj()],
    }),
  );
  registry.register(
    new PrepareHtmlStage({
      logger,
      stagingDir,
      preparers: [new HtmlPreparerJji(), new HtmlPreparerNfj(), new HtmlPreparerBdj()],
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
    new HtmlToMdStage({
      logger,
      stagingDir,
    }),
  );
  registry.register(
    new InterrogateStage({
      logger,
      stagingDir,
    }),
  );

  return registry;
}
