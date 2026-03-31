import type { CleanJson, JobMetadata } from '../../types/Job.js';
import { AbstractCleaner } from '../AbstractCleaner.js';

export class JjiCleaner extends AbstractCleaner {
  clean(listing: Record<string, unknown>, meta: JobMetadata): CleanJson {
    const experienceLevel = listing['experienceLevel'];
    const seniority_level = typeof experienceLevel === 'string' ? experienceLevel : '';

    return {
      locations: [
        ...this.arrayValueByPath(listing, 'multilocation').map((location) => {
          return this.stringValueByPath(location, 'city');
        }),
        this.stringValueByPath(listing, 'workplaceType'),
      ],
      url: meta.job_url,
      expires: this.stringValueByPath(listing, 'expiredAt'),
      position: this.stringValueByPath(listing, 'title'),
      seniority_level,
      contract: this.arrayValueByPath(listing, 'employmentTypes').map((employmentType) => {
        return {
          type: this.stringValueByPath(employmentType, 'type'),
          length: this.stringValueByPath(listing, 'workingTime'),
          currency: this.stringValueByPath(employmentType, 'currency'),
          unit: this.stringValueByPath(employmentType, 'unit'),
          from: this.numberValueByPath(employmentType, 'from').toString(),
          to: this.numberValueByPath(employmentType, 'to').toString(),
        };
      }),
      company: this.stringValueByPath(listing, 'companyName'),
    } satisfies CleanJson;
  }
}
