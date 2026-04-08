export type TLlmResponse<OutputType> = {
  model: string;
  output: OutputType;
  response: unknown;
};

export type TLlmInput = {
  fallback: boolean;
  input: string;
};

export type TModelInput<ConfigType> = {
  input: string;
  model: string;
  config: ConfigType;
};
