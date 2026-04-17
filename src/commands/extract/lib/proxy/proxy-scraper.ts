import assert from 'node:assert';
import type { Logger } from '../../../../lib/logger.js';

interface ProxyData {
  ip_address: string;
  port: string;
  proxy_url: string;
  https?: string;
}

let inFlightFindProxies: Promise<string[]> | null = null;

function parseProxyTable(html: string, logger: Logger): ProxyData[] {
  try {
    const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);

    if (!tableMatch) {
      throw new Error('No table found in HTML');
    }

    let proxyTable: string | null = null;
    for (const table of tableMatch) {
      if (table.includes('IP Address') || /\d+\.\d+\.\d+\.\d+/.test(table)) {
        proxyTable = table;
        break;
      }
    }

    if (!proxyTable) {
      throw new Error('No proxy table found');
    }

    const headerMatch = proxyTable.match(/<thead[\s\S]*?<\/thead>/i);
    if (!headerMatch) {
      throw new Error('No table headers found');
    }

    const headerCells = headerMatch[0].match(/<th[^>]*>(.*?)<\/th>/gi) || [];
    const headers = headerCells.map((cell) =>
      cell
        .replace(/<[^>]*>/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_'),
    );

    const bodyMatch = proxyTable.match(/<tbody[\s\S]*?<\/tbody>/i);
    if (!bodyMatch) {
      throw new Error('No table body found');
    }

    const rowMatches = bodyMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    const proxies: ProxyData[] = [];

    for (const row of rowMatches) {
      const cellMatches = row.match(/<td[^>]*>(.*?)<\/td>/gi) || [];

      if (cellMatches.length === headers.length) {
        const proxy: Record<string, string> = {};

        cellMatches.forEach((cell, index) => {
          proxy[headers[index]] = cell.replace(/<[^>]*>/g, '').trim();
        });

        assert(proxy && proxy.ip_address && proxy.port, 'No required fields in scraped proxy!');
        const row: ProxyData = {
          ...proxy,
          ip_address: proxy.ip_address,
          port: proxy.port,
          proxy_url: `${proxy.ip_address}:${proxy.port}`,
        };
        proxies.push(row);
      }
    }
    return proxies;
  } catch (error) {
    logger.error(` ❌ Failed to parse HTML table: ${(error as Error).message}`);
    return [];
  }
}

export async function findProxies(logger: Logger): Promise<string[]> {
  if (inFlightFindProxies) {
    return inFlightFindProxies;
  }

  inFlightFindProxies = (async () => {
    const FETCH_TIMEOUT_MS = 30_000;
    const proxies = new Set<string>([]);
    const sources = [
      {
        url: 'https://free-proxy-list.net/pl/',
        description: 'Free Proxy List (PL)',
        parser: async (response: Response) => {
          const html = await response.text();
          const parsed = parseProxyTable(html, logger);
          return parsed
            .filter((proxy) => proxy.https === 'yes')
            .map((proxy) => `${proxy.ip_address}:${proxy.port}`);
        },
      },
      {
        url: 'https://free-proxy-list.net/en/ssl-proxy.html',
        description: 'Free Proxy List (EN)',
        parser: async (response: Response) => {
          const html = await response.text();
          const parsed = parseProxyTable(html, logger);
          return parsed
            .filter((proxy) => proxy.https === 'yes')
            .map((proxy) => `${proxy.ip_address}:${proxy.port}`);
        },
      },
      {
        url: 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=https&timeout=10000&country=PL&ssl=yes&anonymity=all&simplified=true',
        description: 'ProxyScrape (PL, API, plain text)',
        parser: async (response: Response) => {
          const text = await response.text();
          return text.split('\n').filter((line) => line.trim() !== '');
        },
      },
      {
        url: 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=https&timeout=10000&country=DE&ssl=yes&anonymity=all&simplified=true',
        description: 'ProxyScrape (DE, API, plain text)',
        parser: async (response: Response) => {
          const text = await response.text();
          return text.split('\n').filter((line) => line.trim() !== '');
        },
      },
      {
        url: 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=https&timeout=10000&country=GB&ssl=yes&anonymity=all&simplified=true',
        description: 'ProxyScrape (GB, API, plain text)',
        parser: async (response: Response) => {
          const text = await response.text();
          return text.split('\n').filter((line) => line.trim() !== '');
        },
      },
    ];

    const tasks = sources.map(async (source) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        logger.log(` 🕒 Fetching proxies from ${source.description} (${source.url})...`);
        const response = await fetch(source.url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch proxy list (${response.status} ${response.statusText})`);
        }

        const extracted = await source.parser(response);
        logger.log(
          ` ✅ Extracted ${extracted.length} proxy entries from ${source.description} (${source.url})`,
        );
        return extracted;
      } finally {
        clearTimeout(timeout);
      }
    });

    const settled = await Promise.allSettled(tasks);
    settled.forEach((result, index) => {
      const source = sources[index];
      if (result.status === 'fulfilled') {
        result.value.forEach((proxy) => proxies.add(proxy));
        return;
      }

      const error = result.reason;
      const message = error instanceof Error ? error.message : String(error);
      const isAbort =
        (error instanceof Error && error.name === 'AbortError') || /aborted|abort/i.test(message);
      if (isAbort) {
        logger.error(
          ` ⏱️ Timed out after ${FETCH_TIMEOUT_MS}ms fetching proxies from ${source.description} (${source.url})`,
        );
      } else {
        logger.error(
          ` ❌ Error fetching/parsing proxies from ${source.description} (${source.url}): ${message}`,
        );
      }
    });

    logger.log(` ✅ Found ${proxies.size} https proxies.`);
    return Array.from(proxies);
  })().finally(() => {
    inFlightFindProxies = null;
  });

  return inFlightFindProxies;
}
