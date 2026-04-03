import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  defaultInterrogateConfig,
  interrogateJobOffer,
  type InterrogateConfig,
} from './interrogate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const skip =
  process.env.SKIP_INTERROGATE_INTEGRATION === '1' ||
  process.env.SKIP_INTERROGATE_INTEGRATION === 'true';

const FIXTURES = ['bdj-job.md', 'nfj-job.md', 'jji-job.md'] as const;

function integrationConfig(): Partial<InterrogateConfig> {
  return {
    host: process.env.OLLAMA_HOST ?? defaultInterrogateConfig.host,
    model: process.env.INTERROGATE_MODEL ?? defaultInterrogateConfig.model,
  } as Partial<InterrogateConfig>;
}

describe.skipIf(skip)('interrogateJobOffer (local Ollama)', { timeout: 120_000 }, () => {
  it.each(FIXTURES)('returns valid Questions for %s', async (filename) => {
    const markdown = readFileSync(join(__dirname, 'fixtures', filename), 'utf8');
    const result = await interrogateJobOffer(markdown, integrationConfig());

    expect(result).toMatchSnapshot();
  });
});
