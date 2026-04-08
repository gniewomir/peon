import { buildUserPrompt, fullSystemPrompt } from './prompt.js';
import { jsonSchema, schema } from './schema.js';
import type { TModelInput, TModelResponse } from './types.js';

const defaultOllamaConfig = {
  host: 'http://127.0.0.1:11434',
  model: 'qwen2.5:7b',
  system: fullSystemPrompt,
  format: jsonSchema,
  stream: false,
  options: {
    temperature: 0.1,
    num_predict: 2000,
  },
} as const;
type OllamaConfig = typeof defaultOllamaConfig;

export async function respond({
  input,
  config = defaultOllamaConfig,
  quality,
}: TModelInput<OllamaConfig, 'qwen2.5:7b'>): Promise<TModelResponse> {
  const payload = {
    ...defaultOllamaConfig,
    ...config,
    prompt: buildUserPrompt(input),
    options: {
      ...defaultOllamaConfig.options,
      ...config.options,
    },
  };
  const model = payload.model;

  const res = await fetch(`${payload.host}/api/generate`, {
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
  const output = schema.parse(parsedJson);
  return {
    model,
    output,
    quality: quality(output),
    response: data,
  };
}
