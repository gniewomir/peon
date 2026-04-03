import type { StagingFileEvent } from '../types.js';

export function isFileEvent(event: StagingFileEvent): boolean {
  return event.type === 'add' || event.type === 'change';
}
