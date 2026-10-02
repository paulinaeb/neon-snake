import type { RunEndReason } from '../application/gameEvents';

// Gameplay analytics events. One gameplay attempt ("play") is identified by playId.
// Timestamps are ISO 8601 UTC; progress is the share of the level target reached (0–1).

export type GameplayStartEvent = {
  type: 'gameplay_start';
  playId: string;
  level: number;
  timestamp: string;
};

export type ScoreChangeEvent = {
  type: 'score_change';
  playId: string;
  level: number;
  score: number;
  progress: number;
  timestamp: string;
};

export type GameplayEndEvent = {
  type: 'gameplay_end';
  playId: string;
  level: number;
  result: RunEndReason;
  score: number;
  progress: number;
  durationMs: number;
  timestamp: string;
};

export type AnalyticsEvent = GameplayStartEvent | ScoreChangeEvent | GameplayEndEvent;
