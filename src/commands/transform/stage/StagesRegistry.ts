import type { AbstractStage } from './AbstractStage.js';
import type { StagingFileEvent } from '../types.js';

export class StagesRegistry {
  private readonly stages: Map<string, AbstractStage> = new Map();

  public register(stage: AbstractStage): void {
    this.stages.set(stage.name(), stage);
  }

  public async handleStagingEvent(event: StagingFileEvent): Promise<void> {
    const stages: Promise<void>[] = [];
    for (const stage of this.stages.values()) {
      stages.push(stage.runIfPreconditionsMet(event));
    }
    await Promise.all(stages);
  }
}
