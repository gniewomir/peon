import puppeteerVanilla from 'puppeteer';
import { addExtra } from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser } from 'puppeteer';
import { proxyContext } from './proxy.js';
import { assertLaunchArgsSafe } from '../launchArgs.js';
import type { Logger, BrowserContext } from '../types/index.js';

/** puppeteer-extra typings expect older PuppeteerNode; current puppeteer drops createBrowserFetcher. */
const puppeteer = addExtra(puppeteerVanilla as never);

const stealth = stealthPlugin();
stealth.enabledEvasions = stealth.availableEvasions;
puppeteer.use(stealth);

const baseLaunchArgs = [
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=TranslateUI',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-component-extensions-with-background-pages',
  '--disable-background-networking',
  '--disable-sync',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=VizDisplayCompositor',
  '--fast-start',
] as const;

export async function browserContext(logger: Logger): Promise<BrowserContext> {
  const { withProxy } = await proxyContext(logger);
  const proxiedBrowsers: Record<string, Browser> = {};

  const cleanup = async (): Promise<void> => {
    for (const [proxyUrl, proxiedBrowser] of Object.entries(proxiedBrowsers)) {
      logger.log(` ⚠️  Closing headless browser for proxy server ${proxyUrl}`);
      await proxiedBrowser.close();
      delete proxiedBrowsers[proxyUrl];
    }
  };

  return {
    withBrowser: async <T>(payload: (browser: Browser) => Promise<T>): Promise<T> => {
      return withProxy(async (proxy: string) => {
        try {
          if (!proxiedBrowsers[proxy]) {
            await cleanup();
            logger.log(' ⚠️  Starting headless browser...');
            const launchArgs = [...baseLaunchArgs, `--proxy-server=${proxy}`];
            assertLaunchArgsSafe(launchArgs);
            proxiedBrowsers[proxy] = await puppeteer.launch({
              headless: true,
              args: launchArgs,
            });
          }
          return await payload(proxiedBrowsers[proxy]);
        } catch (error) {
          logger.error(` ⚠️  Error: ${(error as Error).message}`);
          await cleanup();
          throw error;
        }
      });
    },
    closeBrowser: async (): Promise<void> => {
      await cleanup();
    },
  };
}
