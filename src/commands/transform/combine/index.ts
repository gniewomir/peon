import type { CleanJson } from '../../types/Job.js';
import { extractExpiresFromMarkdown } from './expires.js';

export interface CombinedJson {
  clean: CleanJson;
  interrogated: unknown;
}

export function combineJobData(params: {
  clean: CleanJson;
  interrogated: unknown;
  markdown: string;
  strategySlug: string;
}): CombinedJson {
  const { clean, interrogated, markdown, strategySlug } = params;
  const expires = clean.expires || extractExpiresFromMarkdown(strategySlug, markdown);
  return {
    clean: {
      ...clean,
      expires,
    },
    interrogated,
  };
}
