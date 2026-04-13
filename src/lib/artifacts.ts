import assert from 'node:assert';

type ArtifactDescriptor = {
  filename: string;
  description?: string;
};

export enum KnownArtifactsEnum {
  RAW_JOB_JSON = 'RAW_JOB_JSON',
  RAW_JOB_HTML = 'RAW_JOB_HTML',
  RAW_JOB_META_JSON = 'RAW_JOB_META_JSON',
  RAW_JOB_HTML_JSON = 'RAW_JOB_HTML_JSON',
  CLEAN_JOB_JSON = 'CLEAN_JOB_JSON',
  CLEAN_JOB_HTML = 'CLEAN_JOB_HTML',
  CLEAN_JOB_META_JSON = 'CLEAN_JOB_META_JSON',
  CLEAN_MARKDOWN = 'CLEAN_MARKDOWN',
  LLM_JSON = 'LLM_JSON',
  COMBINED_JSON = 'COMBINED_JSON',
  NORMALIZED_JSON = 'NORMALIZED_JSON',
  VALIDATED_JSON = 'VALIDATED_JSON',
}

const artifactsRegistry: Record<KnownArtifactsEnum, ArtifactDescriptor> = {
  [KnownArtifactsEnum.RAW_JOB_JSON]: {
    filename: 'raw.job.json',
  },
  [KnownArtifactsEnum.RAW_JOB_HTML]: {
    filename: 'raw.job.html',
  },
  [KnownArtifactsEnum.RAW_JOB_META_JSON]: {
    filename: 'raw.meta.json',
  },
  [KnownArtifactsEnum.RAW_JOB_HTML_JSON]: {
    filename: 'raw.html.json',
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
  [KnownArtifactsEnum.LLM_JSON]: {
    filename: 'llm.json',
  },
  [KnownArtifactsEnum.COMBINED_JSON]: {
    filename: 'combined.json',
  },
  [KnownArtifactsEnum.NORMALIZED_JSON]: {
    filename: 'normalized.json',
  },
  [KnownArtifactsEnum.VALIDATED_JSON]: {
    filename: 'validated.json',
  },
} as const;
export type Artifact = keyof typeof artifactsRegistry;

export function artifactFilename(artifact: KnownArtifactsEnum) {
  return artifactsRegistry[artifact].filename;
}

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
