import type { LlmInput, LlmResponse, ModelInput } from './types.js';
import { googleResponse } from './providers/cloud-gemini.js';
import { type OllamaConfig, ollamaResponse } from './providers/local-ollama.js';
import type { GenerateContentConfig } from '@google/genai';
import { jsonSchema } from '../schema/schema.js';
import { basicSystemPrompt, buildUserPrompt, fullSystemPrompt } from './prompt.js';

const llmDefaultProvider = process.env.LLM_PROVIDER || 'local-ollama';
const llmDefaultModel = process.env.LLM_DEFAULT_MODEL || 'llama3.2:latest';
const llmFallbackProvider = process.env.LLM_FALLBACK_PROVIDER || 'local-ollama';
const llmFallbackModel = process.env.LLM_FALLBACK_MODEL || 'qwen2.5:7b';

export function llmStructuredResponse<OutputType>({
  fallback = false,
  input,
}: LlmInput): Promise<LlmResponse<OutputType>> {
  if (
    (!fallback && llmDefaultProvider === 'local-ollama') ||
    (fallback && llmFallbackProvider === 'local-ollama')
  ) {
    return ollamaResponse<OutputType>({
      input,
      model: fallback ? llmFallbackModel : llmDefaultModel,
      config: {
        host: 'http://127.0.0.1:11434',
        system: fullSystemPrompt,
        format: jsonSchema,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 2000,
        },
        prompt: buildUserPrompt(input),
      },
    } satisfies ModelInput<OllamaConfig>);
  }
  if (
    (!fallback && llmDefaultProvider === 'cloud-google') ||
    (fallback && llmFallbackProvider === 'cloud-google')
  ) {
    return googleResponse<OutputType>({
      input,
      model: fallback ? llmFallbackModel : llmDefaultModel,
      config: {
        temperature: 0.1,
        systemInstruction: basicSystemPrompt,
        responseMimeType: 'application/json',
        responseJsonSchema: jsonSchema,
      },
    } satisfies ModelInput<GenerateContentConfig>);
  }
  throw new Error(`Unsupported provider ${llmDefaultProvider}`);
}
