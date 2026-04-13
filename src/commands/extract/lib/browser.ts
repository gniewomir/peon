import puppeteer, { type Browser, type Page } from 'puppeteer';
import { proxyContext } from './proxy.js';
import { getRandomUserAgent } from './user-agent.js';
import type { Logger } from '../../lib/logger.js';
import type { ShutdownContext } from '../../../lib/shutdown.js';

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

const BROWSER_CLOSE_SETTLE_MS = 150;
const MAX_OPEN_PAGES = 10;

export interface BrowserContext extends AsyncDisposable {
  withBrowser<T>(payload: (browser: Browser) => Promise<T>): Promise<T>;
}

const blockedResourceTypes = new Set(['image', 'stylesheet', 'font', 'fetch', 'media']);

export interface PageContext extends AsyncDisposable {
  page: Page;
}

type Semaphore = {
  acquire(): Promise<void>;
  release(): void;
};

function createSemaphore(initialAvailable: number): Semaphore {
  let available = Math.max(0, initialAvailable);
  const waiters: Array<() => void> = [];

  return {
    async acquire(): Promise<void> {
      if (available > 0) {
        available -= 1;
        return;
      }
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    },
    release(): void {
      const next = waiters.shift();
      if (next) next();
      else available += 1;
    },
  };
}

const pageSemaphores = new WeakMap<Browser, Promise<Semaphore>>();

async function getPageSemaphore(browser: Browser): Promise<Semaphore> {
  const existing = pageSemaphores.get(browser);
  if (existing) return existing;

  const created = (async () => {
    const currentOpen = (await browser.pages().catch(() => [])).length;
    const initialAvailable = MAX_OPEN_PAGES - currentOpen;
    return createSemaphore(initialAvailable);
  })();

  pageSemaphores.set(browser, created);
  return created;
}

export async function pageContext(browser: Browser): Promise<PageContext> {
  const semaphore = await getPageSemaphore(browser);
  await semaphore.acquire();

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    semaphore.release();
  };

  let page: Page | undefined;
  try {
    page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      if (blockedResourceTypes.has(request.resourceType())) {
        await request.abort();
      } else {
        await request.continue();
      }
    });
    await page.setUserAgent({
      userAgent: getRandomUserAgent(),
    });
  } catch (error) {
    release();
    throw error;
  }
  return {
    page,
    async [Symbol.asyncDispose]() {
      await page?.close().catch(() => {});
      release();
    },
  };
}

export async function browserContext(
  logger: Logger,
  registry?: ShutdownContext,
): Promise<BrowserContext> {
  const proxyCtx = await proxyContext(logger);
  const proxiedBrowsers: Record<string, Browser> = {};

  const cleanup = async (): Promise<void> => {
    for (const [proxyUrl, proxiedBrowser] of Object.entries(proxiedBrowsers)) {
      logger.log(` ⚠️  Closing headless browser for proxy server ${proxyUrl}`);
      const pid = proxiedBrowser.process()?.pid;
      const pages = await proxiedBrowser.pages();
      await Promise.allSettled(pages.map((p) => p.close().catch(() => {})));
      await new Promise<void>((resolve) => {
        setTimeout(resolve, BROWSER_CLOSE_SETTLE_MS);
      });
      await proxiedBrowser.close();
      if (pid) registry?.deregisterPid(pid);
      delete proxiedBrowsers[proxyUrl];
    }
  };

  registry?.registerCleanup(cleanup);

  return {
    withBrowser: async <T>(payload: (browser: Browser) => Promise<T>): Promise<T> => {
      return proxyCtx.withProxy(async (proxy: string) => {
        try {
          if (!proxiedBrowsers[proxy]) {
            await cleanup();
            logger.log(' ⚠️  Starting headless browser...');
            const launchArgs = [...baseLaunchArgs, `--proxy-server=${proxy}`];
            proxiedBrowsers[proxy] = await puppeteer.launch({
              headless: true,
              args: launchArgs,
            });
            const pid = proxiedBrowsers[proxy].process()?.pid;
            if (pid) registry?.registerPid(pid);
          }
          return await payload(proxiedBrowsers[proxy]);
        } catch (error) {
          logger.error(` ⚠️  Error: ${(error as Error).message}`);
          await cleanup();
          throw error;
        }
      });
    },
    async [Symbol.asyncDispose](): Promise<void> {
      await cleanup();
      registry?.deregisterCleanup(cleanup);
    },
  };
}
