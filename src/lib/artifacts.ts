import assert from 'node:assert';

type ArtifactDescriptor = {
  filename: string;
  description?: string;
};

export enum KnownArtifactsEnum {
  RAW_JOB_JSON = 'RAW_JOB_JSON',
  RAW_JOB_HTML = 'RAW_JOB_HTML',
  RAW_JOB_META = 'RAW_JOB_META',
  RAW_JOB_HTML_JSON = 'RAW_JOB_HTML_JSON',
  CLEAN_JOB_JSON = 'CLEAN_JOB_JSON',
  CLEAN_JOB_HTML = 'CLEAN_JOB_HTML',
  CLEAN_JOB_HTML_JSON = 'CLEAN_JOB_HTML_JSON',
  CLEAN_JOB_META_JSON = 'CLEAN_JOB_META_JSON',
  CLEAN_MARKDOWN = 'CLEAN_MARKDOWN',
  CLEAN_COMBINE_JSON = 'CLEAN_COMBINE_JSON',
  ENRICH_LLM_JSON = 'ENRICH_LLM_JSON',
}

const artifactsRegistry: Record<KnownArtifactsEnum, ArtifactDescriptor> = {
  [KnownArtifactsEnum.RAW_JOB_JSON]: {
    filename: 'raw.job.json',
  },
  [KnownArtifactsEnum.RAW_JOB_HTML]: {
    filename: 'raw.job.html',
  },
  [KnownArtifactsEnum.RAW_JOB_META]: {
    filename: 'raw.meta.json',
  },
  [KnownArtifactsEnum.RAW_JOB_HTML_JSON]: {
    filename: 'raw.html-json.json',
  },
  [KnownArtifactsEnum.CLEAN_JOB_HTML_JSON]: {
    filename: 'clean.html-json.json',
  },
  [KnownArtifactsEnum.CLEAN_JOB_JSON]: {
    filename: 'clean.job.json',
  },
  [KnownArtifactsEnum.CLEAN_JOB_HTML]: {
    filename: 'clean.job.html',
  },
  [KnownArtifactsEnum.CLEAN_JOB_META_JSON]: {
    filename: 'clean.meta.json',
  },
  [KnownArtifactsEnum.CLEAN_MARKDOWN]: {
    filename: 'clean.md',
  },
  [KnownArtifactsEnum.CLEAN_COMBINE_JSON]: {
    filename: 'clean.combined.json',
  },
  [KnownArtifactsEnum.ENRICH_LLM_JSON]: {
    filename: 'enrich.llm.json',
  },
} as const;
export type Artifact = keyof typeof artifactsRegistry;

export function artifactFilename(artifact: KnownArtifactsEnum) {
  return artifactsRegistry[artifact].filename;
}

export function artifactFilenameToEnum(filename: string): KnownArtifactsEnum {
  const found = Object.entries(artifactsRegistry)
    .filter(([, value]) => value.filename === filename)
    .map(([key]) => key)
    .pop();
  assert(found, `${filename} is not a artifact filename`);

  return KnownArtifactsEnum[found as Artifact];
}

export function isArtifactFilename(filename: string) {
  try {
    artifactFilenameToEnum(filename);
    return true;
  } catch {
    return false;
  }
}

export const artifactFilenames = Object.freeze(
  Object.values(artifactsRegistry)
    .map((e) => e.filename)
    .sort(),
);

assert(
  Object.values(artifactsRegistry)
    .map((e) => e.filename)
    .every((f) => f === f.trim().toLowerCase()),
  'Artifact filenames have to be lowercase without whitespace',
);
assert(
  new Set(Object.values(artifactsRegistry).map((e) => e.filename)).size ===
    Object.values(artifactsRegistry).map((e) => e.filename).length,
  'Duplicated file names in artifacts registry!',
);
