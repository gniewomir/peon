import type { TSchema } from '../schema/schema.js';

export type TModelResponse = {
  model: string;
  quality: number;
  output: TSchema;
  response: unknown;
};

export type TModelInput<T, M> = {
  input: string;
  model: M;
  config?: T;
  quality: (output: TSchema) => number;
};
