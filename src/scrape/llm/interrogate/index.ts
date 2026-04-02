import { toJSONSchema } from 'zod';

import { defaultInterrogateConfig, type InterrogateConfig } from './config.js';
import { buildUserPrompt, systemPrompt } from './prompt.js';
import { QuestionsSchema, type Questions } from './schema.js';

/** Zod 4 provides `toJSONSchema`; third-party `zod-to-json-schema` does not support Zod 4 schemas. */
const questionsJsonSchema = toJSONSchema(QuestionsSchema, { target: 'draft-07' });

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, '');
}

function mergeInterrogateConfig(overrides?: Partial<InterrogateConfig>): InterrogateConfig {
  if (!overrides) {
    return {
      ...defaultInterrogateConfig,
      options: { ...defaultInterrogateConfig.options },
    };
  }
  return {
    ...defaultInterrogateConfig,
    ...overrides,
    options: {
      ...defaultInterrogateConfig.options,
      ...overrides.options,
    },
  };
}

export async function interrogateJobOffer(
  markdown: string,
  configOverrides?: Partial<InterrogateConfig>,
): Promise<Questions> {
  const config = mergeInterrogateConfig(configOverrides);
  const host = normalizeHost(config.host);

  const payload = {
    model: config.model,
    system: systemPrompt,
    prompt: buildUserPrompt(markdown),
    format: questionsJsonSchema,
    stream: false,
    options: { ...config.options },
  };

  const res = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama request failed (${res.status}): ${body || '<empty>'}`);
  }

  const data: unknown = await res.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    !('response' in data) ||
    typeof (data as { response?: unknown }).response !== 'string'
  ) {
    throw new Error('Unexpected Ollama response shape (missing response string).');
  }

  const raw = (data as { response: string }).response.trim();
  const parsedJson: unknown = JSON.parse(raw);
  return QuestionsSchema.parse(parsedJson);
}

export type { Questions } from './schema.js';
export { defaultInterrogateConfig, type InterrogateConfig } from './config.js';
