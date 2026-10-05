import type { LevelMetrics, Outcome, Overview } from './api/analytics';

// One fixed order and color per outcome, used by every chart: completed first so it always grows
// from the shared left baseline. Colors live in styles.css (--complete, --fail, --quit).
export const OUTCOMES: { key: Outcome; label: string; description: string }[] = [
  { key: 'complete', label: 'Completed', description: 'reached the fruit target' },
  { key: 'fail', label: 'Failed', description: 'crashed before the target' },
  { key: 'quit', label: 'Quit', description: 'left the level mid-run' }
];

export type OutcomeCounts = Record<Outcome, number>;

export const overviewCounts = (overview: Overview): OutcomeCounts => ({
  complete: overview.completedPlays,
  fail: overview.failedPlays,
  quit: overview.quitPlays
});

export const levelCounts = (level: LevelMetrics): OutcomeCounts => ({
  complete: level.completed,
  fail: level.failed,
  quit: level.quit
});
