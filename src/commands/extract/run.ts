import 'dotenv/config';

import * as path from 'node:path';
import { type ILogger, loggerContext } from '../lib/logger.js';
import { browserContext } from './lib/browser.js';
import { getRandomUserAgent } from './lib/user-agent.js';
import { getRandomNumber } from './lib/random.js';
import { SCRAPE_REQUEST_TIMEOUT_MS } from './constants.js';
import type { JobJson, Strategy } from './types/index.js';
import { cacheContext } from './lib/cache.js';

class HttpException extends Error {}

export interface RunExtractOptions {
  outDir: string;
  cacheDir: string;
  strategies: Strategy[];
  verbose: boolean;
}

async function runStrategy(
  strategy: Strategy,
  outDir: string,
  cacheDir: string,
  verbose: boolean,
): Promise<void> {
  const { withLogger } = loggerContext({ prefix: strategy.slug, verbose });
  await withLogger(async (logger: ILogger) => {
    await cacheContext(path.join(cacheDir, strategy.slug)).withCache(async (cache) => {
      const { withBrowser, closeBrowser } = await browserContext(logger);
      try {
        for await (const listing of strategy.jobListingsGenerator()) {
          logger.log(
            ` 🏁‍ Processing listing "${listing.description}" for strategy ${strategy.slug}`,
          );
          for await (const job of strategy.jobGenerator(listing, logger, cache)) {
            await withBrowser(async (browser) => {
              try {
                const url = strategy.jobToUrl(job as JobJson);
                const cacheKey = cache.weeklyCacheKey(url);

                let content: string;

                if (cache.hasCacheKey(cacheKey, logger)) {
                  content = await cache.readCache(cacheKey, logger);
                  strategy.stats.cache_hit += 1;
                } else {
                  logger.log(` 🔗 Opening ${strategy.slug} url: ${url}`);
                  const page = await browser.newPage();
                  await page.setRequestInterception(true);
                  page.on('request', async (request) => {
                    if (
                      ['image', 'stylesheet', 'font', 'fetch', 'media'].includes(
                        request.resourceType(),
                      )
                    ) {
                      await request.abort();
                    } else {
                      await request.continue();
                    }
                  });
                  await page.setUserAgent(getRandomUserAgent());
                  const res = await page.goto(url, {
                    waitUntil: 'load',
                    timeout: SCRAPE_REQUEST_TIMEOUT_MS,
                  });

                  if (!res) {
                    logger.warn(' ⚠️  No response received from puppeteer.');
                  }
                  if (res && res.status() < 400) {
                    logger.log(`✅ Response status ${res.status()} for ${url}.`);
                  }
                  if (res && res.status() >= 400) {
                    throw new HttpException(` ⚠️  Response status: ${res.status()} for ${url}`);
                  }

                  const bodyHandle = await page.$('body');

                  if (bodyHandle) {
                    content = await page.evaluate((body) => body.innerHTML, bodyHandle);
                    await bodyHandle.dispose();
                  } else {
                    throw new HttpException(` ⚠️  No <body> for ${url};`);
                  }

                  await page.close();

                  if (await cache.writeCache(cacheKey, content, logger)) {
                    strategy.stats.cache_writes += 1;
                  }
                  strategy.stats.cache_miss += 1;

                  const wait = getRandomNumber(1000, 5000);
                  logger.log(` 🕒 Waiting for ${Math.round(wait / 1000)}s`);
                  await new Promise((resolve) => setTimeout(resolve, wait));
                }

                await strategy.save({
                  outDir,
                  cached: cache.cacheFilePath(cacheKey),
                  job: job as JobJson,
                  url,
                  content,
                  logger,
                });

                strategy.stats.writes += 1;
              } catch (error) {
                strategy.stats.errors += 1;
                if (error instanceof HttpException) {
                  console.error(` ⚠️  Skipping because of error ${error.message}`);
                  return;
                }

                throw error;
              }
            });

            strategy.stats.job_processed += 1;
          }

          strategy.stats.unique = strategy.ids.size;
          strategy.stats.listings_processed += 1;
        }
        logger.log(` ✅ Strategy ${strategy.slug} completed successfully. Done`);
      } catch (error) {
        logger.error(` ⚠️  Strategy ${strategy.slug} error:`, error);
        throw error;
      } finally {
        await closeBrowser();
        logger.log(` ℹ️  Stats for ${strategy.slug} ${JSON.stringify(strategy.stats)}`);
      }
    });
  });
}

export async function runExtract(options: RunExtractOptions): Promise<void> {
  const { withLogger } = loggerContext({ prefix: 'scr', verbose: options.verbose });
  await withLogger(async (logger: ILogger) => {
    const strategies = options.strategies;
    try {
      await Promise.all(
        strategies.map(async (strategy) =>
          runStrategy(strategy, options.outDir, options.cacheDir, options.verbose),
        ),
      );
      logger.log(' ✅ All strategies finished successfully. Done');
    } catch (error) {
      logger.error(' ⚠️  Strategy error forced process termination.', error);
      throw error;
    } finally {
      strategies.forEach((strategy) => {
        logger.log(` 🔧 stats for ${strategy.slug} ${JSON.stringify(strategy.stats)}`);
      });
    }
  });
}
