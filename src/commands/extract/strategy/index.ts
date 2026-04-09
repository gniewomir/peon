import { BDJ_SLUG, bdjStrategy } from './bdj/bdj.js';
import { JJI_SLUG, jjiStrategy } from './jji/jji.js';
import { NFJ_SLUG, nfjStrategy } from './nfj/nfj.js';
import type { Strategy } from './types.js';

const STRATEGY_REGISTRY = [
  { slug: JJI_SLUG, create: jjiStrategy },
  { slug: NFJ_SLUG, create: nfjStrategy },
  { slug: BDJ_SLUG, create: bdjStrategy },
] as const;

export function strategyFactoryBySlug(): Map<string, () => Strategy> {
  return new Map(STRATEGY_REGISTRY.map((e) => [e.slug, e.create]));
}

export function allStrategies(): Strategy[] {
  return STRATEGY_REGISTRY.map((e) => e.create());
}

export { jjiStrategy, nfjStrategy, bdjStrategy };
export { JJI_SLUG, NFJ_SLUG, BDJ_SLUG };
