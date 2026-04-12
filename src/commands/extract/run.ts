import 'dotenv/config';

import * as path from 'node:path';
import { type Logger } from '../lib/logger.js';
import { browserContext, pageContext } from './lib/browser.js';
import { getRandomNumber } from './lib/random.js';
import { cacheContext } from './lib/cache.js';
import { type ShutdownRegistry } from './lib/shutdown.js';
import type { Strategy } from './strategy/types.js';
import type { JobJson } from './types.js';

class HttpException extends Error {}

async function runStrategy({
  strategy,
  stagingDir,
  cacheDir,
  registry,
  logger,
}: {
  strategy: Strategy;
  stagingDir: string;
  cacheDir: string;
  registry: ShutdownRegistry;
  logger: Logger;
}): Promise<void> {
  await cacheContext(path.join(cacheDir, strategy.slug)).withCache(async (cache) => {
    await using ctx = await browserContext(logger, registry);
    try {
      for await (const listing of strategy.jobListingsGenerator()) {
        logger.log(
          ` 🏁‍ Processing listing "${listing.description}" for strategy ${strategy.slug}`,
        );
        for await (const job of strategy.jobGenerator(listing, logger, cache)) {
          await ctx.withBrowser(async (browser) => {
            try {
              const url = strategy.jobToUrl(job as JobJson);
              const cacheKey = cache.weeklyCacheKey(url);

              let content: string;

              if (await cache.hasCacheKey(cacheKey, logger)) {
                content = await cache.readCache(cacheKey, logger);
              } else {
                logger.log(` 🔗 Opening ${strategy.slug} url: ${url}`);
                await using ctx = await pageContext(browser);
                const res = await ctx.page.goto(url, strategy.pageOpenOptions());

                if (!res) {
                  logger.warn(' ⚠️  No response received from puppeteer.');
                }
                if (res && res.status() < 400) {
                  logger.log(`✅ Response status ${res.status()} for ${url}.`);
                }
                if (res && res.status() >= 400) {
                  throw new HttpException(` ⚠️  Response status: ${res.status()} for ${url}`);
                }

                const bodyHandle = await ctx.page.$('body');

                if (bodyHandle) {
                  content = await ctx.page.evaluate((body) => body.innerHTML, bodyHandle);
                  await bodyHandle.dispose();
                } else {
                  throw new HttpException(` ⚠️  No <body> for ${url};`);
                }

                await cache.writeCache(cacheKey, content, logger);

                const wait = getRandomNumber(1000, 5000);
                logger.log(` 🕒 Waiting for ${Math.round(wait / 1000)}s`);
                await new Promise((resolve) => setTimeout(resolve, wait));
              }

              await strategy.save({
                outDir: stagingDir,
                cached: cache.cacheFilePath(cacheKey),
                job: job as JobJson,
                url,
                content,
                logger,
              });
            } catch (error) {
              if (error instanceof HttpException) {
                logger.error(` ⚠️  Skipping because of error ${error.message}`);
                return;
              }

              throw error;
            }
          });
        }
      }
      logger.log(` ✅ Strategy ${strategy.slug} completed successfully. Done`);
    } catch (error) {
      logger.error(` ⚠️  Strategy ${strategy.slug} error:`, error);
      throw error;
    }
  });
}

export async function runExtract({
  stagingDir,
  cacheDir,
  strategies,
  logger,
  registry,
}: {
  stagingDir: string;
  cacheDir: string;
  strategies: Strategy[];
  logger: Logger;
  registry: ShutdownRegistry;
}): Promise<void> {
  try {
    await Promise.all(
      strategies.map(async (strategy) =>
        runStrategy({
          strategy,
          stagingDir,
          cacheDir,
          registry,
          logger: logger.withSuffix(strategy.slug),
        }),
      ),
    );
    logger.log(' ✅ All strategies finished successfully. Done');
  } catch (error) {
    logger.error(' ⚠️  Strategy error forced process termination.', error);
    throw error;
  }
}
