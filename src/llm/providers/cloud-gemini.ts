import { type GenerateContentConfig, GoogleGenAI } from '@google/genai';
import { buildUserPrompt } from '../prompt.js';
import type { ModelInput, LlmResponse } from '../types.js';

let cachedClient: null | GoogleGenAI;
function getClient() {
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }
  return cachedClient;
}

export async function googleResponse<OutputType>({
  input,
  model = 'gemini-2.5-flash-lite',
  config,
}: ModelInput<GenerateContentConfig>): Promise<LlmResponse<OutputType>> {
  const response = await getClient().models.generateContent({
    model,
    contents: buildUserPrompt(input),
    config,
  });
  const output = JSON.parse(response.text || '{}');
  return {
    model,
    output,
    debug: response,
  };
}
