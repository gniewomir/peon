import { sNamespace, sString } from './schema.utils.js';
import { z } from 'zod';
import { nullSchema, schemaObject } from './schema.js';

export const llmObject = {
  model: sString('Responding llm model'),
  output: sNamespace(schemaObject, 'Llm structured output'),
  debug: z.unknown(),
};
export const llmSchema = sNamespace(llmObject, 'LLM response');
export type TLlmSchema = z.infer<typeof llmSchema>;
export const nullLlmSchema = (): TLlmSchema => ({
  model: null,
  output: nullSchema(),
  debug: null,
});
