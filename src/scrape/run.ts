import 'dotenv/config';

import assert from 'node:assert';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { loggerContext } from './lib/logger.js';
import { readCache, writeCache, hasCacheKey, weeklyCacheKey } from './lib/cache.js';
import { browserContext } from './lib/browser.js';
import { getRandomUserAgent } from './lib/user-agent.js';
import { getRandomNumber } from './lib/random.js';
import { smartSave } from './lib/smart-save.js';
import { setCacheRoot } from './cacheContext.js';
import type { BaseStrategy, ProcessedJob, Logger, BaseJob } from './types/index.js';

class HttpException extends Error {}

export interface RunScrapeOptions {
  outDir: string;
  cacheDir: string;
  strategies: BaseStrategy[];
}

async function runStrategy(strategy: BaseStrategy, outDir: string): Promise<void> {
  const { withLogger } = loggerContext(strategy.slug);
  await withLogger(async (logger: Logger) => {
    const { withBrowser, closeBrowser } = await browserContext(logger);
    try {
      for await (const listing of strategy.listingsGenerator()) {
        logger.log(
          ` 🏁‍ Processing listing "${listing.description}" for strategy ${strategy.slug}`,
        );
        for await (const job of strategy.jobGenerator(listing, logger)) {
          assert(!('strategy_id' in job), 'strategy_id property already in job!');
          assert(!('strategy_slug' in job), 'strategy_slug property already in job!');
          assert(!('strategy_url' in job), 'strategy_url property already in job!');
          assert(
            !('strategy_html_content' in job),
            'strategy_html_content property already in job!',
          );
          assert(
            !('strategy_html_content_hash' in job),
            'strategy_html_content_hash property already in job!',
          );
          assert(!('strategy_from_cache' in job), 'strategy_from_cache property already in job!');
          assert(!('strategy_is_up' in job), 'strategy_is_up property already in job!');

          await withBrowser(async (browser) => {
            try {
              const url = strategy.jobToUrl(job as BaseJob);
              const cacheKey = weeklyCacheKey(url);

              let content: string;
              let fromCache: boolean;

              if (hasCacheKey(cacheKey, logger)) {
                content = await readCache(cacheKey, logger);
                strategy.stats.cache_hit += 1;
                fromCache = true;
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
                const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

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
                content = await page.evaluate((body) => body.innerHTML, bodyHandle);
                await bodyHandle?.dispose();

                await page.close();

                strategy.stats.cache_writes += await writeCache(cacheKey, content, logger);
                strategy.stats.cache_miss += 1;
                fromCache = false;

                const wait = getRandomNumber(1000, 5000);
                logger.log(` 🕒 Waiting for ${Math.round(wait / 1000)}s`);
                await new Promise((resolve) => setTimeout(resolve, wait));
              }

              const extracted = strategy.extractContent(content);
              const processedJob: ProcessedJob = {
                ...job,
                strategy_id: strategy.jobToId(job as BaseJob),
                strategy_url: url,
                strategy_slug: strategy.slug,
                strategy_from_cache: fromCache,
                strategy_is_up: fromCache ? null : true,
                strategy_html_content: extracted,
                strategy_html_content_hash: crypto
                  .createHash('md5')
                  .update(extracted)
                  .digest('hex'),
              };

              const filePath = path.join(
                outDir,
                strategy.slug,
                `${strategy.jobToId(job as BaseJob)}.json`,
              );
              const saveResult = await smartSave(filePath, processedJob, false, logger);
              strategy.stats.writes += saveResult;
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
}

export async function runScrape(options: RunScrapeOptions): Promise<void> {
  setCacheRoot(options.cacheDir);
  const { withLogger } = loggerContext('scr');
  await withLogger(async (logger: Logger) => {
    const strategies = options.strategies;
    try {
      await Promise.all(strategies.map(async (strategy) => runStrategy(strategy, options.outDir)));
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
