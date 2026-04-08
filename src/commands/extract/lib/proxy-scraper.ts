import assert from 'node:assert';
import type { ILogger } from '../../lib/logger.js';

interface ProxyData {
  ip_address: string;
  port: string;
  proxy_url: string;
  https?: string;
}

function parseProxyTable(html: string, logger: ILogger): ProxyData[] {
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

    logger.log(` ✅ Extracted ${proxies.length} proxy entries`);
    return proxies;
  } catch (error) {
    logger.error(` ❌ Failed to parse HTML table: ${(error as Error).message}`);
    throw error;
  }
}

export async function findProxies(logger: ILogger): Promise<string[]> {
  const proxies = new Set<string>([]);
  for (const url of [
    'https://free-proxy-list.net/pl/',
    'https://free-proxy-list.net/en/ssl-proxy.html',
  ]) {
    const response = await fetch(url);
    const parsed = parseProxyTable(await response.text(), logger);
    parsed
      .filter((proxy) => proxy.https === 'yes')
      .forEach((proxy) => {
        proxies.add(`${proxy.ip_address}:${proxy.port}`);
      });
  }
  logger.log(` ✅ Found ${proxies.size} https proxies.`);
  return Array.from(proxies);
}
