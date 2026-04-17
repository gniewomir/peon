import { randomUUID } from 'node:crypto';
import type { Logger } from '../../../../lib/logger.js';
import type { ShutdownContext } from '../../../../lib/shutdown.js';
import { ProxyRegistry } from './ProxyRegistry.js';

interface ProxyContext {
  withProxy<T>(payload: (proxy: string) => Promise<T>): Promise<T>;
}

let globalRegistry: ProxyRegistry | null = null;
let globalRegistryInit: Promise<void> | null = null;

async function getRegistry(logger: Logger, shutdownCtx?: ShutdownContext): Promise<ProxyRegistry> {
  if (!globalRegistry) {
    globalRegistry = new ProxyRegistry(logger.withSuffix('proxy-registry'));
  }
  globalRegistry.registerPersistence(shutdownCtx);
  if (!globalRegistryInit) {
    globalRegistryInit = globalRegistry.load();
  }
  await globalRegistryInit;
  return globalRegistry;
}

export async function proxyContext(
  logger: Logger,
  shutdownCtx?: ShutdownContext,
): Promise<ProxyContext> {
  const registry = await getRegistry(logger, shutdownCtx);
  const consumerId = randomUUID();
  let activeLease: Awaited<ReturnType<ProxyRegistry['acquire']>> | null = null;

  return {
    withProxy: async <T>(payload: (proxy: string) => Promise<T>): Promise<T> => {
      while (true) {
        if (!activeLease) {
          activeLease = await registry.acquire(consumerId);
          logger.log(` ⚠️  Using proxy: ${activeLease.proxyUrl}`);
        }
        try {
          const result = await payload(activeLease.proxyUrl);
          registry.reportSuccess(activeLease);
          return result;
        } catch (error) {
          logger.error(` ⚠️  Error during processing proxied payload: ${(error as Error).message}`);
          if (activeLease) {
            logger.log(` ⚠️  Switching proxy from: ${activeLease.proxyUrl}`);
            registry.reportFailure(activeLease);
            registry.release(activeLease);
            activeLease = null;
          }
        }
      }
    },
  };
}
