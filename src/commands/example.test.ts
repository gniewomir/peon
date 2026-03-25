import { describe, expect, it } from 'vitest';
import { registerExampleCommand } from './example.js';

describe('registerExampleCommand', () => {
  it('is a function', () => {
    expect(typeof registerExampleCommand).toBe('function');
  });
});
