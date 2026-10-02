import type { RunSummary } from './gameEvents';

// Platform hooks awaited by the controller around gameplay transitions.
// Gameplay starts, pauses, resumes, and leaves a run only after the matching promise resolves.
export interface SessionLifecycle {
  gameStart(level: number): Promise<void>;
  gameEnd(run: RunSummary): Promise<void>;
  gameFinished(): Promise<void>;
  gamePause(): Promise<void>;
  gameResume(): Promise<void>;
}

export const immediateLifecycle: SessionLifecycle = {
  gameStart: async () => {},
  gameEnd: async () => {},
  gameFinished: async () => {},
  gamePause: async () => {},
  gameResume: async () => {}
};
