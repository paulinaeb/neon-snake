import type { GameSnapshot, PauseSource } from '../game/types';

export type RunEndReason = 'complete' | 'fail' | 'quit';

// One gameplay attempt: from entering active play on a level until it is completed, failed, or left.
export type RunSummary = {
  runId: string;
  level: number;
  reason: RunEndReason;
  score: number;
  progress: number;
  durationMs: number;
  occurredAt: number;
};

export type GameEventMap = {
  ready: { occurredAt: number };
  runStarted: { runId: string; level: number; runNumber: number; occurredAt: number };
  // Score or level progress changed during an active run (not emitted for the starting values).
  runUpdated: { runId: string; level: number; score: number; progress: number; occurredAt: number };
  runEnded: RunSummary;
  scoreChanged: { level: number; score: number; delta: number };
  progressChanged: { level: number; progress: number; collected: number; target: number };
  pauseChanged: { paused: boolean; source: PauseSource };
  audioChanged: { playerMuted: boolean; systemMuted: boolean; effectiveMuted: boolean };
  gameFinished: { score: number; bestScore: number };
  stateChanged: GameSnapshot;
};
