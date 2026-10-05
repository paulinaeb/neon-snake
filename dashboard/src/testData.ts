import type { DashboardData, LevelMetrics, Overview } from './api/analytics';

// Shaped like real /api/analytics responses, including unrounded averages.
export const level = (overrides: Partial<LevelMetrics> & Pick<LevelMetrics, 'level'>): LevelMetrics => ({
  plays: 0,
  completed: 0,
  failed: 0,
  quit: 0,
  completionRate: null,
  averageScore: null,
  averageProgress: null,
  averageUnfinishedProgress: null,
  averageDurationMs: null,
  ...overrides
});

export const populated: DashboardData = {
  overview: {
    totalPlays: 47,
    completedPlays: 21,
    failedPlays: 19,
    quitPlays: 7,
    completionRate: 0.44680851063829785,
    averageScore: 92.12765957446808,
    averageProgress: 0.6534278959810875,
    averageUnfinishedProgress: 0.37350427350427345,
    averageDurationMs: 14511.829787234043
  },
  levels: [
    level({
      level: 1,
      plays: 18,
      completed: 10,
      failed: 7,
      quit: 1,
      completionRate: 0.5555555555555556,
      averageScore: 37.77777777777778,
      averageProgress: 0.7555555555555556,
      averageUnfinishedProgress: 0.44999999999999996,
      averageDurationMs: 14377.5
    }),
    level({
      level: 2,
      plays: 16,
      completed: 8,
      failed: 6,
      quit: 2,
      completionRate: 0.5,
      averageScore: 96.25,
      averageProgress: 0.6875,
      averageUnfinishedProgress: 0.37499999999999994,
      averageDurationMs: 15845.25
    }),
    level({
      level: 3,
      plays: 13,
      completed: 3,
      failed: 6,
      quit: 4,
      completionRate: 0.23076923076923078,
      averageScore: 162.30769230769232,
      averageProgress: 0.4700854700854701,
      averageUnfinishedProgress: 0.3111111111111111,
      averageDurationMs: 13056.692307692309
    })
  ]
};

export const emptyOverview: Overview = {
  totalPlays: 0,
  completedPlays: 0,
  failedPlays: 0,
  quitPlays: 0,
  completionRate: null,
  averageScore: null,
  averageProgress: null,
  averageUnfinishedProgress: null,
  averageDurationMs: null
};
