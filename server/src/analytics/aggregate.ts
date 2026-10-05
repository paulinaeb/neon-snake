import type { GameplayResult } from './schema';

// A finished gameplay attempt, read from a stored gameplay_end event.
export type PlayOutcome = {
  playId: string;
  level: number;
  result: GameplayResult;
  score: number;
  progress: number;
  durationMs: number;
  occurredAt: Date;
};

export type PlayMetrics = {
  totalPlays: number;
  completedPlays: number;
  failedPlays: number;
  quitPlays: number;
  // Share of plays that were completed (0–1); null when there are no plays.
  completionRate: number | null;
  averageScore: number | null;
  averageProgress: number | null;
  // Average progress of plays that were not completed (fail or quit): how far players get before a
  // run ends early. null when every play was completed.
  averageUnfinishedProgress: number | null;
  averageDurationMs: number | null;
};

export type LevelMetrics = {
  level: number;
  plays: number;
  completed: number;
  failed: number;
  quit: number;
  completionRate: number | null;
  averageScore: number | null;
  averageProgress: number | null;
  averageUnfinishedProgress: number | null;
  averageDurationMs: number | null;
};

// gameplay_end is the canonical record of a play. Each play ends once, so a repeated gameplay_end
// for the same playId (e.g. a duplicated request) is counted only once, keeping the earliest.
export const uniquePlays = (outcomes: PlayOutcome[]): PlayOutcome[] => {
  const byPlay = new Map<string, PlayOutcome>();
  for (const outcome of outcomes) {
    const existing = byPlay.get(outcome.playId);
    if (!existing || outcome.occurredAt < existing.occurredAt) byPlay.set(outcome.playId, outcome);
  }
  return [...byPlay.values()];
};

const average = (plays: PlayOutcome[], value: (play: PlayOutcome) => number): number | null =>
  plays.length === 0 ? null : plays.reduce((sum, play) => sum + value(play), 0) / plays.length;

const summarize = (plays: PlayOutcome[]): PlayMetrics => {
  const count = (result: GameplayResult) => plays.filter((play) => play.result === result).length;
  const completedPlays = count('complete');
  return {
    totalPlays: plays.length,
    completedPlays,
    failedPlays: count('fail'),
    quitPlays: count('quit'),
    completionRate: plays.length === 0 ? null : completedPlays / plays.length,
    averageScore: average(plays, (play) => play.score),
    averageProgress: average(plays, (play) => play.progress),
    averageUnfinishedProgress: average(
      plays.filter((play) => play.result !== 'complete'),
      (play) => play.progress
    ),
    averageDurationMs: average(plays, (play) => play.durationMs)
  };
};

export const computeOverview = (outcomes: PlayOutcome[]): PlayMetrics => summarize(uniquePlays(outcomes));

// One entry per level that has at least one finished play, ordered by level.
export const computeLevels = (outcomes: PlayOutcome[]): LevelMetrics[] => {
  const byLevel = new Map<number, PlayOutcome[]>();
  for (const play of uniquePlays(outcomes)) {
    byLevel.set(play.level, [...(byLevel.get(play.level) ?? []), play]);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, plays]) => {
      const metrics = summarize(plays);
      return {
        level,
        plays: metrics.totalPlays,
        completed: metrics.completedPlays,
        failed: metrics.failedPlays,
        quit: metrics.quitPlays,
        completionRate: metrics.completionRate,
        averageScore: metrics.averageScore,
        averageProgress: metrics.averageProgress,
        averageUnfinishedProgress: metrics.averageUnfinishedProgress,
        averageDurationMs: metrics.averageDurationMs
      };
    });
};
