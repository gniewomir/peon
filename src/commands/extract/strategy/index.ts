import type { Strategy } from './types.js';
import { type Logger } from '../../lib/logger.js';
import { JjiStrategy } from './jji/JjiStrategy.js';
import { BdjStrategy } from './bdj/BdjStrategy.js';
import { NfjStrategy } from './nfj/NfjStrategy.js';
import type { AbstractStrategy } from './AbstractStrategy.js';
import type { KnownStrategy } from '../../lib/types.js';

const STRATEGY_REGISTRY = [
  (logger: Logger) => new BdjStrategy(logger),
  (logger: Logger) => new JjiStrategy(logger),
  (logger: Logger) => new NfjStrategy(logger),
] as const;

let instantiated: null | AbstractStrategy[] = null;

export function selectStrategies(chosen: Set<KnownStrategy> | 'all', logger: Logger): Strategy[] {
  if (instantiated === null) {
    instantiated = STRATEGY_REGISTRY.map((e) => e(logger));
  }
  if (chosen === 'all') {
    return [...instantiated];
  }
  const unknownStrategies = instantiated
    .filter((strat) => !chosen.has(strat.slug))
    .map((strat) => strat.slug);
  if (unknownStrategies.length > 0) {
    const knownStrategies = instantiated.map((strat) => strat.slug);
    throw new Error(
      `Strategies ${unknownStrategies.join(', ')} do not exist.` +
        `Use ${knownStrategies.join(' ')}`,
    );
  }
  return instantiated.filter((strat) => chosen.has(strat.slug));
}
