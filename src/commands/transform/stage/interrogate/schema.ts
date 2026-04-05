import { z } from 'zod';

const unknownString = z.string().default('unknown').catch('unknown');
const unknownBool = z.boolean().nullable().default(null).catch(null);

export const ConfessionSchema = z.object({
  job: z.object({
    title: unknownString,
    company: unknownString,
    role: z
      .enum([
        'Backend',
        'Frontend',
        'Fullstack',
        'Mobile',
        'DevOps',
        'Data',
        'AI',
        'Security',
        'other',
        'unknown',
      ])
      .default('unknown')
      .catch('unknown'),
  }),

  workplace: z.object({
    isRemote: unknownBool,
    isHybrid: unknownBool,
    isOnsite: unknownBool,
    cities: z.array(z.string()),
    workEnvironment: z
      .enum(['startup', 'scaleup', 'corporate', 'other', 'unknown'])
      .default('unknown')
      .catch('unknown'),
    jobOfferTone: z
      .enum(['formal', 'hip', 'grind/hustle', 'other', 'unknown'])
      .default('unknown')
      .catch('unknown'),
    crunch: unknownBool,
  }),

  contract: z.object({
    type: z.enum(['employment', 'b2b', 'other', 'unknown']).default('unknown').catch('unknown'),
    length: z
      .enum(['part-time', 'full-time', 'project', 'internship', 'other', 'unknown'])
      .default('unknown')
      .catch('unknown'),
    salaryFrom: z.object({
      currency: unknownString,
      amount: unknownString,
    }),
    salaryTo: z.object({
      currency: unknownString,
      amount: unknownString,
    }),
  }),

  benefits: z.object({
    hasPTO: unknownBool,
    hasRSU: unknownBool,
    hasMultisport: unknownBool,
  }),

  expectations: z.object({
    seniority: z
      .enum(['junior', 'mid', 'senior', 'staff', 'principal', 'manager', 'c-level', 'unknown'])
      .default('unknown')
      .catch('unknown'),

    leadership: z
      .enum(['individual contributor', 'technical', 'team', 'vertical', 'company', 'unknown'])
      .default('unknown')
      .catch('unknown'),

    specialization: z
      .enum(['focused expert', 'generalist', 'fast-learner', 'unknown'])
      .default('unknown')
      .catch('unknown'),

    requiredTechnologies: z.array(z.string()),
    niceToHaveTechnologies: z.array(z.string()),
    requiredSkills: z.array(z.string()),
    niceToHaveSkills: z.array(z.string()),
  }),
});

export type Confession = z.infer<typeof ConfessionSchema>;
