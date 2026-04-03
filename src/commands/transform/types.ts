export type StagingFileEvent = {
  type: 'add' | 'change' | 'error';
  payload: string;
  error?: unknown;
};
