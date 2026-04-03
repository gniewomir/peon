import chokidar from 'chokidar';
import { createConcurrencyLimiter } from './lib/limiter.js';
import { readFile } from 'fs/promises';
import { interrogateJobOffer } from './interrogate/index.js';
import { Queue } from './lib/queue.js';
import { convert } from '@kreuzberg/html-to-markdown-node';
import { smartSave } from '../lib/smart-save.js';
import { loggerContext } from '../lib/logger.js';
import type { Logger } from '../types/Logger.js';
import { cleanerByStrategySlug } from './cleaners/index.js';
import type { CleanJson, JobMetadata } from '../types/Job.js';
import { cleanMissingInputs, combineMissingInputs, jobDirFromFilePath } from './lib/readiness.js';
import { combineJobData } from './combine/index.js';
import { quarantineJobDirectory } from './lib/quarantine.js';

export interface RunTransformOptions {
  stagingDir: string;
}

type Event = {
  type: 'add' | 'change' | 'error';
  payload: string;
  error?: unknown;
};

const buffer = new Queue<Event>();

function isFileEvent(event: Event): boolean {
  return event.type === 'add' || event.type === 'change';
}

function markdownAvailable(event: Event): boolean {
  return isFileEvent(event) && event.payload.endsWith('/job.md');
}

function htmlAvailable(event: Event): boolean {
  return isFileEvent(event) && event.payload.endsWith('/job.html');
}

function cleanAvailable(event: Event): boolean {
  return isFileEvent(event) && event.payload.endsWith('/job.json');
}

function combineAvailable(event: Event): boolean {
  if (!isFileEvent(event)) {
    return false;
  }
  return (
    event.payload.endsWith('/job.clean.json') ||
    event.payload.endsWith('/job.interrogated.json') ||
    event.payload.endsWith('/job.md')
  );
}

function errorAvailable(event: Event): boolean {
  return event.type === 'error';
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function readMetadata(jobDir: string): Promise<JobMetadata> {
  const metaPath = `${jobDir}/meta.json`;
  const meta = await readJson<JobMetadata>(metaPath);
  if (typeof meta.strategy_slug !== 'string' || !meta.files || typeof meta.files !== 'object') {
    throw new Error(`Invalid metadata in ${metaPath}`);
  }
  return meta;
}

async function runStageOrQuarantine(params: {
  logger: Logger;
  stagingDir: string;
  eventPath: string;
  stage: string;
  run: () => Promise<void>;
}): Promise<boolean> {
  const { logger, stagingDir, eventPath, stage, run } = params;
  try {
    await run();
    return true;
  } catch (error) {
    const jobDir = jobDirFromFilePath(eventPath);
    await quarantineJobDirectory({
      logger,
      stagingDir,
      jobDir,
      stage,
      error,
      inputPaths: [eventPath],
    });
    return false;
  }
}

export async function processTransformEvent(params: {
  logger: Logger;
  stagingDir: string;
  event: Event;
  markdownLimiter: ReturnType<typeof createConcurrencyLimiter>;
  interrogateLimiter: ReturnType<typeof createConcurrencyLimiter>;
  cleanLimiter: ReturnType<typeof createConcurrencyLimiter>;
  combineLimiter: ReturnType<typeof createConcurrencyLimiter>;
}): Promise<void> {
  const {
    logger,
    stagingDir,
    event,
    markdownLimiter,
    interrogateLimiter,
    cleanLimiter,
    combineLimiter,
  } = params;
  if (errorAvailable(event)) {
    logger.error(`error: ${event.payload} moving to quarantine`, event.error);
    return;
  }

  if (htmlAvailable(event)) {
    const keepGoing = await runStageOrQuarantine({
      logger,
      stagingDir,
      eventPath: event.payload,
      stage: 'markdown',
      run: async () => {
        await markdownLimiter.run(async () => {
          const html = await readFile(event.payload, 'utf8');
          const markdown = convert(html, {
            // @ts-expect-error work around: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
            headingStyle: 'Atx',
            // @ts-expect-error work around: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
            codeBlockStyle: 'Backticks',
            wrap: true,
            wrapWidth: 100,
          });
          await smartSave(event.payload.replace('.html', '.md'), markdown, false, logger);
          logger.log(`html to markdown: ${event.payload}`);
        });
      },
    });
    if (!keepGoing) {
      return;
    }
  }

  if (markdownAvailable(event)) {
    const keepGoing = await runStageOrQuarantine({
      logger,
      stagingDir,
      eventPath: event.payload,
      stage: 'interrogate',
      run: async () => {
        await interrogateLimiter.run(async () => {
          const markdown = await readFile(event.payload, 'utf8');
          const questions = await interrogateJobOffer(markdown);
          await smartSave(
            event.payload.replace('.md', '.interrogated.json'),
            questions,
            false,
            logger,
          );
          logger.log(`interrogated markdown: ${event.payload}`);
        });
      },
    });
    if (!keepGoing) {
      return;
    }
  }

  if (cleanAvailable(event)) {
    const keepGoing = await runStageOrQuarantine({
      logger,
      stagingDir,
      eventPath: event.payload,
      stage: 'clean',
      run: async () => {
        await cleanLimiter.run(async () => {
          const meta = await readMetadata(jobDirFromFilePath(event.payload));
          const missing = cleanMissingInputs(meta);
          if (missing.length > 0) {
            throw new Error(`Missing clean inputs: ${missing.join(', ')}`);
          }
          const listing = await readJson<Record<string, unknown>>(meta.files.job_json);
          const cleaner = cleanerByStrategySlug(meta.strategy_slug);
          if (!cleaner) {
            throw new Error(`No cleaner registered for strategy "${meta.strategy_slug}"`);
          }
          const cleaned = cleaner.clean(listing, meta);
          await smartSave(meta.files.job_clean_json, cleaned, false, logger);
          logger.log(`cleaned job json: ${meta.files.job_json}`);
        });
      },
    });
    if (!keepGoing) {
      return;
    }
  }

  if (combineAvailable(event)) {
    await runStageOrQuarantine({
      logger,
      stagingDir,
      eventPath: event.payload,
      stage: 'combine',
      run: async () => {
        await combineLimiter.run(async () => {
          const meta = await readMetadata(jobDirFromFilePath(event.payload));
          const missing = combineMissingInputs(meta);
          if (missing.length > 0) {
            logger.log(
              `combine skipped for ${meta.job_id}; waiting for: ${missing.map((m) => m.split('/').pop()).join(', ')}`,
            );
            return;
          }
          const clean = await readJson<CleanJson>(meta.files.job_clean_json);
          const interrogated = await readJson<unknown>(meta.files.job_interrogated_json);
          const markdown = await readFile(meta.files.job_markdown, 'utf8');
          const combined = combineJobData({
            clean,
            interrogated,
            markdown,
            strategySlug: meta.strategy_slug,
          });
          await smartSave(meta.files.job_combined_json, combined, false, logger);
          logger.log(`combined job files: ${meta.job_staging_dir}`);
        });
      },
    });
  }
}

async function drainBuffer({
  logger,
  stagingDir,
  wait,
}: {
  logger: Logger;
  stagingDir: string;
  wait: () => boolean;
}): Promise<void> {
  const markdownLimiter = createConcurrencyLimiter(10);
  const interrogateLimiter = createConcurrencyLimiter(2);
  const cleanLimiter = createConcurrencyLimiter(10);
  const combineLimiter = createConcurrencyLimiter(10);

  while (wait() || !buffer.isEmpty()) {
    const event = buffer.shift();
    if (!event && wait()) {
      logger.warn('no buffered events, waiting 1000ms for next one...');
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    if (!event) {
      break;
    }
    await processTransformEvent({
      logger,
      stagingDir,
      event,
      markdownLimiter,
      interrogateLimiter,
      cleanLimiter,
      combineLimiter,
    });
    logger.log(`[event: ${event.type} ${event.payload}`);
  }
}

export async function runTransform(options: RunTransformOptions): Promise<void> {
  const { stagingDir } = options;
  const { withLogger } = loggerContext('transform');

  await withLogger(async (logger) => {
    const watcher = chokidar.watch(stagingDir, {
      ignoreInitial: false,
      persistent: true,
    });

    watcher.on('add', (filePath) => {
      console.log(`added: ${filePath}`);
      buffer.append({ type: 'add', payload: filePath });
    });

    watcher.on('change', (filePath) => {
      logger.log(`changed: ${filePath}`);
      buffer.append({ type: 'change', payload: filePath });
    });

    watcher.on('error', (error) => {
      logger.error('watcher error:', error);
      buffer.append({ type: 'error', payload: 'unknown error', error });
    });

    await new Promise<void>((resolve, reject) => {
      let wait = true;
      const drain = drainBuffer({ logger, stagingDir, wait: () => wait });
      const shutdown = async () => {
        logger.log('shutting down watcher...');
        try {
          await watcher.close();
          wait = false;
          await drain;
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      process.once('SIGINT', () => {
        void shutdown();
      });

      process.once('SIGTERM', () => {
        void shutdown();
      });

      logger.log(`Watching for changes in: ${stagingDir}`);
    });
  });
}
