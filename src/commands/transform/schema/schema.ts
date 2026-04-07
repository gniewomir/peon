import { toJSONSchema, z } from 'zod';

function sString(prompt: string) {
  return z.string().trim().min(1).nullable().default(null).catch(null).describe(prompt);
}

function sStringArray(prompt: string) {
  return z.array(z.string().trim().min(1).nullable().default(null).catch(null)).describe(prompt);
}

function sEnum(values: string[], prompt: string) {
  return z.enum(values).describe(prompt);
}

function sBool(prompt: string) {
  return z.boolean().nullable().default(null).catch(null).describe(prompt);
}

function sNamespace<T extends Record<string, unknown>>(namespace: T, prompt: string) {
  return z.object(namespace).describe(prompt);
}

function sDateTime(prompt: string) {
  // NOTE: using datetime will crash ollama schema to grammar parser ATM
  return sString(prompt);
}

export const schema = sNamespace(
  {
    offer: sNamespace(
      {
        url: sString('Job offer URL'),
        source: sString('Job offer source'),
        publishedAt: sDateTime('Offer publication date and time'),
        expiresAt: sDateTime('Offer expiration date and time'),
        updatedAt: sDateTime('Offer last update date and time'),
      },
      'Job offer metadata',
    ),
    employer: sNamespace(
      {
        name: sString('Employer name'),
        type: sEnum(
          ['startup', 'scaleup', 'corporation', 'outsourcing agency', 'software house'],
          'Employer company type',
        ),
      },
      'Employer details',
    ),
    role: sNamespace(
      {
        title: sString('Role title'),
        seniority: sEnum(
          [
            'intern',
            'junior',
            'regular',
            'senior',
            'expert',
            'staff',
            'principal',
            'lead',
            'management',
          ],
          'Role seniority',
        ),
        focus: sEnum(
          [
            'backend',
            'frontend',
            'fullstack',
            'devops',
            'security',
            'mobile',
            'design',
            'testing',
            'management',
          ],
          'Primary role focus',
        ),
        specialization: sEnum(['specialized', 'generalist'], 'Role specialization profile'),
        scope: sEnum(['full-time', 'part-time', 'project'], 'Role engagement scope'),
      },
      'Role details',
    ),
    workplace: sNamespace(
      {
        isRemote: sBool('Whether fully remote work is allowed'),
        isHybrid: sBool('Whether hybrid work is required or expected'),
        isOnsite: sBool('Whether mostly onsite work is required'),
        travel: sBool('Whether work-related travel is required'),
        cities: sStringArray('Allowed work locations (cities)'),
      },
      'Workplace model and location',
    ),
    contract: sNamespace(
      {
        type: sEnum(
          ['employment', 'b2b/contractor', 'mandate contract', 'internship'],
          'Contract type',
        ),
        pto: sBool('Whether paid time off is provided'),
        bankHolidays: sBool('Whether paid bank holidays are provided'),
      },
      'Contract terms',
    ),
    salary: sNamespace(
      {
        transparentCompensation: sBool('Whether salary range is disclosed'),
        from: sString('Minimum compensation amount (number as string)'),
        to: sString('Maximum compensation amount (number as string)'),
        currency: sString('Compensation currency'),
        unit: sEnum(['hour', 'day', 'week', 'month', 'year'], 'Compensation period unit'),
      },
      'Compensation details',
    ),
    benefits: sNamespace(
      {
        rsu: sBool('Whether equity-based compensation is provided'),
        bonus: sBool('Whether bonus compensation is provided'),
        multisport: sBool('Whether sports card benefit is provided'),
      },
      'Benefits',
    ),
    naturalLanguages: sStringArray(
      'Required natural languages (always add English, if input is in English)',
    ),
    hardTechnologyRequirements: sStringArray('Required technologies and tools'),
    optionalTechnologyRequirements: sStringArray('Optional or nice-to-have technologies and tools'),
    hardSkills: sStringArray('Required hard technical skills'),
    softSkills: sStringArray('Required soft skills'),
    technicalEnvironment: sNamespace(
      {
        aiFirst: sBool('Whether AI-native tooling is expected in day-to-day work'),
        aiFriendly: sBool('Whether AI tooling familiarity is a plus'),
        ddd: sBool('Whether Domain-Driven Design is used or expected'),
        testFirst: sBool('Whether testing-first practices are emphasized'),
        architecture: sEnum(
          ['monolith', 'microservices', 'embedded', 'lambda/edge'],
          'System architecture style (lamda/edge, if Vercel is a requirement)',
        ),
        stage: sEnum(['greenfield', 'mature', 'legacy'], 'System lifecycle stage'),
      },
      'Technical environment',
    ),
  },
  `
Rules:
- If a string value cannot be confidently inferred, output null.
- For booleans: true/false if clearly stated or strongly implied; otherwise null.
- For arrays: always output an array (use [] if none).
- Prefer short, canonical tokens in lists (e.g. "TypeScript", "PostgreSQL", "AWS", "Docker"). Keep original capitalization.
`,
);

export type TSchema = z.infer<typeof schema>;
export const jsonSchema = toJSONSchema(schema, { target: 'draft-07' });
