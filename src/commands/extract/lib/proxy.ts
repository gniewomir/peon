import { getRandomNumber } from './random.js';
import { findProxies } from './proxy-scraper.js';
import type { Logger } from '../../lib/logger.js';

interface ProxyContext {
  withProxy<T>(payload: (proxy: string) => Promise<T>): Promise<T>;
}

async function* proxyGenerator(logger: Logger): AsyncGenerator<string> {
  while (true) {
    const proxyList = [...(await findProxies(logger))].reverse();
    while (proxyList.length > 0) {
      const proxy = proxyList.pop();
      if (proxy) {
        yield proxy;
      }
    }
  }
}

export async function proxyContext(logger: Logger): Promise<ProxyContext> {
  const maxConsecutiveFailures = 20;
  let consecutiveFailures = 0;
  let proxyGen = proxyGenerator(logger);
  let currentProxy = (await proxyGen.next()).value;
  logger.log(` ⚠️  Using proxy: ${currentProxy}`);

  return {
    withProxy: async <T>(payload: (proxy: string) => Promise<T>): Promise<T> => {
      while (true) {
        try {
          const result = await payload(currentProxy);
          consecutiveFailures = 0;
          return result;
        } catch (error) {
          logger.error(` ⚠️  Error during processing proxied payload: ${(error as Error).message}`);
          logger.log(` ⚠️  Switching proxy from: ${currentProxy}`);
          consecutiveFailures = consecutiveFailures + 1;

          if (consecutiveFailures >= maxConsecutiveFailures) {
            logger.warn(' ⚠️  Reached max consecutive failures - refreshing proxies');
            proxyGen = proxyGenerator(logger);
            currentProxy = (await proxyGen.next()).value;
            consecutiveFailures = 0;
          } else {
            currentProxy = (await proxyGen.next()).value;
          }

          if (!currentProxy) {
            throw new Error(' ⚠️  No proxy available - terminating');
          } else {
            logger.log(` ⚠️  Switched to proxy: ${currentProxy}`);
          }

          const wait = getRandomNumber(10000, 20000);
          logger.log(` 🕒 Waiting for ${Math.round(wait / 1000)}s`);
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
      }
    },
  };
}
