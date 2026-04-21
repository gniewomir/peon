import 'dotenv/config';

import * as path from 'node:path';
import { type Logger } from '../../lib/logger.js';
import { browserContext, pageContext } from './lib/browser.js';
import { getRandomNumber } from './lib/random.js';
import { cacheContext } from './lib/cache.js';
import { shutdownContext, type ShutdownContext } from '../../lib/shutdown.js';
import type { Strategy } from './strategy/types.js';
import type { ItemJson } from './types.js';
import { stats, statsAddToCounter, statsContext } from '../../lib/stats.js';

class HttpException extends Error {}

async function runStrategy({
  strategy,
  cacheDir,
  shutdownCtx,
  logger,
}: {
  strategy: Strategy;
  cacheDir: string;
  shutdownCtx: ShutdownContext;
  logger: Logger;
}): Promise<void> {
  await using browserCtx = await browserContext(logger, shutdownCtx);
  const cacheCtx = cacheContext(path.join(cacheDir, strategy.slug));

  try {
    for await (const listing of strategy.listingGenerator()) {
      logger.log(` 🏁‍ Processing listing "${listing.description}" for strategy ${strategy.slug}`);
      for await (const job of strategy.itemGenerator(listing, cacheCtx)) {
        await browserCtx.withBrowser(async (browser) => {
          try {
            const url = strategy.itemToUrl(job as ItemJson);
            const cacheKey = cacheCtx.weeklyCacheKey(url);

            let html: string;

            if (await cacheCtx.hasCacheKey(cacheKey, logger)) {
              html = await cacheCtx.readCache(cacheKey, logger);
              statsAddToCounter('item_from_cache');
              statsAddToCounter(`item_from_cache_${strategy.slug}`);
            } else {
              logger.log(` 🔗 Opening ${strategy.slug} url: ${url}`);
              await using pageCtx = await pageContext(browser);
              const res = await pageCtx.page.goto(url, strategy.pageOpenOptions());

              if (res && (res.status() >= 300 || res.status() < 200)) {
                throw new HttpException(` ⚠️  Response status: ${res.status()} for ${url}`);
              } else if (res) {
                logger.log(`✅ Response status ${res.status()} for ${url}.`);
              } else {
                throw new HttpException(' ⚠️  No response received from puppeteer.');
              }

              const bodyHandle = await pageCtx.page.$('body');

              if (bodyHandle) {
                html = await pageCtx.page.evaluate((body) => body.innerHTML, bodyHandle);
                await bodyHandle.dispose();
              } else {
                throw new HttpException(` ⚠️  No <body> for ${url};`);
              }

              statsAddToCounter('item_from_browser');
              statsAddToCounter(`item_from_browser_${strategy.slug}`);

              await cacheCtx.writeCache(cacheKey, html, logger);

              const wait = getRandomNumber(1000, 5000);
              logger.log(` 🕒 Waiting for ${Math.round(wait / 1000)}s`);
              await new Promise((resolve) => setTimeout(resolve, wait));
            }

            await strategy.save({
              cachePath: cacheCtx.cacheFilePath(cacheKey),
              json: job as ItemJson,
              url,
              html,
            });
            statsAddToCounter('item');
            statsAddToCounter(`item_${strategy.slug}`);
          } catch (error) {
            if (error instanceof HttpException) {
              statsAddToCounter('item_handled_errors');
              statsAddToCounter(`item_handled_errors_${strategy.slug}`);
              logger.error(` ⚠️  Skipping because of error ${error.message}`);
              return;
            }
            statsAddToCounter('item_unhandled_errors');
            statsAddToCounter(`item_unhandled_errors_${strategy.slug}`);

            throw error;
          }
        });
      }
    }
    logger.log(` ✅ Strategy ${strategy.slug} completed successfully. Done`);
  } catch (error) {
    statsAddToCounter('strategy_unhandled_errors');
    statsAddToCounter(`strategy_unhandled_errors_${strategy.slug}`);
    logger.error(` ⚠️  Strategy ${strategy.slug} error:`, error);
    throw error;
  }
}

export async function runExtract({
  cacheDir,
  strategies,
  logger,
}: {
  cacheDir: string;
  strategies: Strategy[];
  logger: Logger;
}): Promise<void> {
  const statsCtx = statsContext('extract_');
  return statsCtx.withStats(async () => {
    const shutdownCtx = shutdownContext(logger);
    shutdownCtx.registerCleanup(async () => {
      logger.log(` 📊 Stats: ${JSON.stringify(stats())}`);
    });
    try {
      await Promise.all(
        strategies.map(async (strategy) =>
          runStrategy({
            strategy,
            cacheDir,
            shutdownCtx,
            logger: logger.withSuffix(strategy.slug),
          }),
        ),
      );
      logger.log(' ✅ All strategies finished successfully. Done');
      logger.log(` 📊 Stats: ${JSON.stringify(stats())}`);
    } catch (error) {
      logger.error(' ⚠️  Strategy error forced process termination.', error);
      throw error;
    }
  });
}
