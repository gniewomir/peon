import type { AbstractStage } from './abstract-stage/AbstractStage.js';
import type { StagingFileEvent } from '../types.js';

export class StageRegistry {
  private readonly stages: Map<string, AbstractStage> = new Map();

  public register(stage: AbstractStage): void {
    this.stages.set(stage.name(), stage);
  }

  public async handleStagingEvent(event: StagingFileEvent): Promise<void> {
    const queue = Promise.resolve();
    for (const stage of this.stages.values()) {
      queue.then(() => stage.runIfPreconditionsMet(event));
    }
    await queue;
  }
}
