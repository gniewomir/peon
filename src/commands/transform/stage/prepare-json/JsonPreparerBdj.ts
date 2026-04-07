import type { JobMetadata } from '../../../types/Job.js';
import { AbstractJsonPreparer } from './AbstractJsonPreparer.js';
import { requireObject } from './prepare-object.js';

export class JsonPreparerBdj extends AbstractJsonPreparer {
  strategy(): string {
    return 'bdj';
  }

  prepare(input: unknown, meta: JobMetadata): Record<string, unknown> {
    const job = requireObject(input, {
      strategy: this.strategy(),
      filePath: `${meta.job_dir}/raw-job.json`,
    });
    if (typeof job.id !== 'string' || job.id.length === 0) {
      throw new Error(`BDJ job payload missing non-empty "id" in "${meta.job_dir}/raw-job.json"`);
    }
    if (typeof job.url !== 'string' || job.url.length === 0) {
      throw new Error(`BDJ job payload missing non-empty "url" in "${meta.job_dir}/raw-job.json"`);
    }
    return job;
  }
}
