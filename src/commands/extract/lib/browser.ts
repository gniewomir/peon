import puppeteer, { type Browser } from 'puppeteer';
import { proxyContext } from './proxy.js';
import type { BrowserContext } from '../types/index.js';
import type { ILogger } from '../../lib/logger.js';
import type { ShutdownRegistry } from './shutdown.js';

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

const UNSAFE_FLAG_NAMES = new Set(['no-sandbox', 'disable-setuid-sandbox']);

function argDisablesSandbox(arg: string): boolean {
  if (arg === '--no-sandbox' || arg === '--disable-setuid-sandbox') {
    return true;
  }
  if (arg.startsWith('--no-sandbox=') || arg.startsWith('--disable-setuid-sandbox=')) {
    return true;
  }
  if (arg.startsWith('--') && arg.includes('=')) {
    const name = arg.slice(2).split('=')[0];
    if (name) {
      return UNSAFE_FLAG_NAMES.has(name);
    }
  }
  return false;
}

/**
 * Refuses Chromium flags that disable the sandbox unless PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX=1.
 */
export function assertLaunchArgsSafe(args: string[]): void {
  const unsafe = args.filter(argDisablesSandbox);
  if (unsafe.length === 0) {
    return;
  }
  if (process.env.PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX === '1') {
    console.warn(
      'peon extract: PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX=1 — launching with sandbox-disabling flags:',
      unsafe.join(', '),
    );
    return;
  }
  throw new Error(
    `Refusing Chromium args that disable sandbox: ${unsafe.join(', ')}. ` +
      'Fix the host environment (e.g. non-root Docker, user namespaces), or set PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX=1 if you accept the risk.',
  );
}

/** Lets CDP finish tearing down pages before browser.close() to reduce TargetCloseError races. */
const BROWSER_CLOSE_SETTLE_MS = 150;

export async function browserContext(
  logger: ILogger,
  registry?: ShutdownRegistry,
): Promise<BrowserContext> {
  const { withProxy } = await proxyContext(logger);
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
    closeBrowser: async (): Promise<void> => {
      await cleanup();
      registry?.deregisterCleanup(cleanup);
    },
  };
}
