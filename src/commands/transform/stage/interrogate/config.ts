export const defaultInterrogateConfig = {
  host: 'http://127.0.0.1:11434',
  model: 'qwen2.5:7b',
  options: {
    temperature: 0.1,
    num_predict: 2000,
  },
} as const;

export type InterrogateConfig = typeof defaultInterrogateConfig;
