import { toJSONSchema, z } from 'zod';
import { sBool, sEnum, sEnumArray, sNamespace, sString, sStringArray } from './schema.utils.js';

export const schemaObject = {
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
          'architect',
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
          'DevOps',
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
      type: sEnumArray(['employment', 'b2b/contractor', 'other'], 'Available contract types'),
      pto: sBool('Whether paid time off is provided (true for employment contract type)'),
      bankHolidays: sBool(
        'Whether paid bank holidays are provided (true for employment contract type)',
      ),
    },
    'Contract terms',
  ),
  salaryCoE: sNamespace(
    {
      from: sString('Minimum compensation amount for employment (number as string)'),
      to: sString('Maximum compensation amount for employment (number as string)'),
      currency: sString('Compensation currency for employment'),
      unit: sEnum(
        ['hour', 'day', 'week', 'month', 'year'],
        'Compensation period unit for employment',
      ),
    },
    'Employment compensation details',
  ),
  salaryB2B: sNamespace(
    {
      from: sString('Minimum compensation amount for B2B (number as string)'),
      to: sString('Maximum compensation amount for B2B  (number as string)'),
      currency: sString('Compensation currency for B2B '),
      unit: sEnum(['hour', 'day', 'week', 'month', 'year'], 'Compensation period unit for B2B '),
    },
    'B2B compensation details',
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
};
export const schema = sNamespace(
  schemaObject,
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
export const nullSchema: TSchema = {
  employer: { name: null, type: null },
  role: {
    title: null,
    seniority: null,
    focus: null,
    specialization: null,
    scope: null,
  },
  workplace: {
    isRemote: null,
    isHybrid: null,
    isOnsite: null,
    travel: null,
    cities: [],
  },
  contract: {
    type: [],
    pto: null,
    bankHolidays: null,
  },
  salaryCoE: {
    from: null,
    to: null,
    currency: null,
    unit: null,
  },
  salaryB2B: {
    from: null,
    to: null,
    currency: null,
    unit: null,
  },
  benefits: {
    rsu: null,
    bonus: null,
    multisport: null,
  },
  naturalLanguages: [],
  hardTechnologyRequirements: [],
  optionalTechnologyRequirements: [],
  hardSkills: [],
  softSkills: [],
  technicalEnvironment: {
    aiFirst: null,
    aiFriendly: null,
    ddd: null,
    testFirst: null,
    architecture: null,
    stage: null,
  },
};
