export type StagingFileEvent = {
  type: 'add' | 'change' | 'removeDirectory' | 'error';
  payload: string;
  error?: unknown;
};
