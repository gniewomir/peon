import type { TSchema } from '../../../../schema/schema.js';
import { deepVisitor } from '../../lib/deepVisitor.js';

export const qualityEstimator = (output: TSchema) => {
  let valid = 0;
  let total = 0;

  deepVisitor(output, (value) => {
    if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
      //
    } else {
      valid++;
    }
    total++;
  });

  if (total === 0 || valid === 0) return 0;

  return valid / total;
};
