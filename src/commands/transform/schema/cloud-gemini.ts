import 'dotenv/config';

import { type GenerateContentConfig, GoogleGenAI } from '@google/genai';
import { basicSystemPrompt, buildUserPrompt } from './prompt.js';
import type { TModelInput, TModelResponse } from './types.js';
import { jsonSchema, schema } from './schema.js';

let cachedClient: null | GoogleGenAI;
function getClient() {
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }
  return cachedClient;
}

export async function respond({
  input,
  model = 'gemini-2.5-flash-lite',
  config,
  quality,
}: TModelInput<
  GenerateContentConfig,
  'gemini-2.5-flash-lite' | 'gemini-2.5-flash'
>): Promise<TModelResponse> {
  const response = await getClient().models.generateContent({
    model,
    contents: buildUserPrompt(input),
    config: {
      temperature: 0.1,
      systemInstruction: basicSystemPrompt,
      responseMimeType: 'application/json',
      responseJsonSchema: jsonSchema,
      ...config,
    },
  });
  const output = schema.parse(JSON.parse(response.text || '{}'));
  return {
    model,
    quality: quality(output),
    output: schema.parse(JSON.parse(response.text || '{}')),
    response,
  };
}
