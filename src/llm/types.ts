export type LlmResponse<OutputType> = {
  model: string;
  output: OutputType;
  debug: unknown;
};

export type LlmInput = {
  fallback: boolean;
  input: string;
};

export type ModelInput<ConfigType> = {
  input: string;
  model: string;
  config: ConfigType;
};
