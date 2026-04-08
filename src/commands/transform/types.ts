export type StagingFileEvent = {
  type: 'add' | 'change';
  payload: string;
};
