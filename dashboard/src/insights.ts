import type { LevelMetrics } from './api/analytics';
import { formatPercent, plural } from './format';

// Below this many plays a level's completion rate is flagged as a small sample.
export const SMALL_SAMPLE = 5;

// A one-sentence reading of the level chart, derived only from the data shown in it.
export const describeLevelDifficulty = (levels: LevelMetrics[]): string | null => {
  const measured = levels.filter((level) => level.plays > 0 && level.completionRate !== null);
  if (measured.length === 0) return null;
  if (measured.length === 1) {
    const [only] = measured;
    return `Only level ${only.level} has finished plays so far, so levels cannot be compared yet.`;
  }

  const byRate = [...measured].sort((a, b) => a.completionRate! - b.completionRate! || a.level - b.level);
  const hardest = byRate[0];
  const easiest = byRate[byRate.length - 1];
  if (hardest.completionRate === easiest.completionRate) {
    return `Every level has the same completion rate (${formatPercent(hardest.completionRate)}).`;
  }

  const sample = (level: LevelMetrics) =>
    `${formatPercent(level.completionRate)} of ${plural(level.plays, 'play')}${level.plays < SMALL_SAMPLE ? ' (a small sample)' : ''}`;
  const endings =
    hardest.failed > hardest.quit
      ? 'Most of its unfinished runs end in a crash.'
      : hardest.quit > hardest.failed
        ? 'Most of its unfinished runs end with the player quitting.'
        : hardest.failed > 0
          ? 'Its unfinished runs split evenly between crashes and quits.'
          : '';

  return [
    `Level ${hardest.level} is the hardest so far: ${sample(hardest)} completed, against ${sample(easiest)} on level ${easiest.level}.`,
    endings
  ]
    .filter(Boolean)
    .join(' ');
};
