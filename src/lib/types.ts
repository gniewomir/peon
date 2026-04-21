const strategyRegister = {
  jji: {},
  nfj: {},
  bdj: {},
  ptc: {},
} as const;
export type KnownStrategy = keyof typeof strategyRegister;
export type StrategySelector = KnownStrategy | 'all';

export function isStrategySlug(val: unknown): val is KnownStrategy {
  if (!(typeof val === 'string')) {
    return false;
  }
  return Object.keys(strategyRegister).includes(val);
}
