import { CleanJsonStage } from './clean-json/CleanJsonStage.js';
import type { Logger } from '../../types/Logger.js';
import { CleanerBdj } from './clean-json/CleanerBdj.js';
import { CleanerJji } from './clean-json/CleanerJji.js';
import { CleanerNfj } from './clean-json/CleanerNfj.js';
import { HtmlToMdStage } from './html-to-md/HtmlToMdStage.js';
import { InterrogateStage } from './interrogate/InterrogateStage.js';
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
