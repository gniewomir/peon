import type { JobMetadata } from '../../../types/Job.js';
import { AbstractJsonPreparer } from './AbstractJsonPreparer.js';
import { requireObject } from './prepare-object.js';

export class JsonPreparerJji extends AbstractJsonPreparer {
  strategy(): string {
    return 'jji';
  }

  prepare(input: unknown, meta: JobMetadata): Record<string, unknown> {
    const job = requireObject(input, {
      strategy: this.strategy(),
      filePath: `${meta.job_staging_dir}/raw-job.json`,
    });
    if (typeof job.guid !== 'string' || job.guid.length === 0) {
      throw new Error(
        `JJI job payload missing non-empty "guid" in "${meta.job_staging_dir}/raw-job.json"`,
      );
    }
    if (typeof job.slug !== 'string' || job.slug.length === 0) {
      throw new Error(
        `JJI job payload missing non-empty "slug" in "${meta.job_staging_dir}/raw-job.json"`,
      );
    }
    return job;
  }
}
