import { sNamespace, sString } from './schema.utils.js';
import { z } from 'zod';

export const llmObject = {
  model: sString('Responding llm model'),
  output: z.object().nullable(),
  debug: z.unknown(),
};
export const llmSchema = sNamespace(llmObject, 'LLM response');
export type TLlmSchema = z.infer<typeof llmSchema>;
export const nullLlmSchema = (): TLlmSchema => ({
  model: null,
  output: null,
  debug: null,
});
