import type { Browser } from 'puppeteer';

export interface BrowserContext {
  withBrowser<T>(payload: (browser: Browser) => Promise<T>): Promise<T>;
  closeBrowser(): Promise<void>;
}
