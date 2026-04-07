import { describe, expect, it } from 'vitest';

import { buildFullSystemPromptFromSchema } from './prompt.js';

describe('buildSystemPromptFromSchema', () => {
  it('generates stable system prompt', () => {
    const prompt = buildFullSystemPromptFromSchema();

    expect(prompt).toMatchSnapshot();
  });
});
