import 'dotenv/config';

import * as path from 'node:path';
import { type Logger } from '../../lib/logger.js';
import { browserContext, pageContext } from './lib/browser.js';
import { getRandomNumber } from './lib/random.js';
import { cacheContext } from './lib/cache.js';
import { shutdownContext, type ShutdownContext } from '../../lib/shutdown.js';
import type { Strategy } from './strategy/types.js';
import type { JobJson } from './types.js';
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

  await cacheCtx.withCache(async (cache) => {
    try {
      for await (const listing of strategy.jobListingsGenerator()) {
        logger.log(
          ` 🏁‍ Processing listing "${listing.description}" for strategy ${strategy.slug}`,
        );
        for await (const job of strategy.jobGenerator(listing, cache)) {
          await browserCtx.withBrowser(async (browser) => {
            try {
              const url = strategy.jobToUrl(job as JobJson);
              const cacheKey = cache.weeklyCacheKey(url);

              let html: string;

              if (await cache.hasCacheKey(cacheKey, logger)) {
                html = await cache.readCache(cacheKey, logger);
                statsAddToCounter('jobs_from_cache');
                statsAddToCounter(`jobs_from_cache_${strategy.slug}`);
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

                statsAddToCounter('job_from_browser');
                statsAddToCounter(`job_from_browser_${strategy.slug}`);

                await cache.writeCache(cacheKey, html, logger);

                const wait = getRandomNumber(1000, 5000);
                logger.log(` 🕒 Waiting for ${Math.round(wait / 1000)}s`);
                await new Promise((resolve) => setTimeout(resolve, wait));
              }

              await strategy.save({
                cachePath: cache.cacheFilePath(cacheKey),
                json: job as JobJson,
                url,
                html,
              });
              statsAddToCounter('job');
              statsAddToCounter(`job_${strategy.slug}`);
            } catch (error) {
              if (error instanceof HttpException) {
                statsAddToCounter('job_handled_errors');
                statsAddToCounter(`job_handled_errors_${strategy.slug}`);
                logger.error(` ⚠️  Skipping because of error ${error.message}`);
                return;
              }
              statsAddToCounter('job_unhandled_errors');
              statsAddToCounter(`job_unhandled_errors_${strategy.slug}`);

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
  });
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
  const shutdownCtx = shutdownContext(logger);
  return statsCtx.withStats(async () => {
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
