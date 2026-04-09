import { buildUserPrompt } from '../prompt.js';
import { jsonSchema } from '../../schema/schema.js';
import type { TModelInput, TLlmResponse } from '../types.js';

export type OllamaConfig = {
  host: string;
  system: string;
  format: typeof jsonSchema;
  prompt: string;
  stream: boolean;
  options: {
    temperature: number;
    num_predict: number;
  };
};

export async function ollamaResponse<OutputType>({
  input,
  model,
  config,
}: TModelInput<OllamaConfig>): Promise<TLlmResponse<OutputType>> {
  const res = await fetch(`${config.host}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...config,
      model,
      input: buildUserPrompt(input),
    }),
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
  const output = JSON.parse((data as { response: string }).response.trim() || '{}');
  if ('response' in data) {
    /**
     * Drop, already present as output
     */
    delete data.response;
  }
  if ('context' in data) {
    /**
     * Drop, atm it is just noise
     */
    delete data.context;
  }
  return {
    model,
    output,
    response: data,
  };
}
