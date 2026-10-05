import { describe, expect, it } from 'vitest';

import { describeLevelDifficulty } from './insights';
import { level, populated } from './testData';

describe('level difficulty insight', () => {
  it('names the level with the lowest completion rate and how its runs end', () => {
    expect(describeLevelDifficulty(populated.levels)).toBe(
      'Level 3 is the hardest so far: 23% of 13 plays completed, against 56% of 18 plays on level 1. Most of its unfinished runs end in a crash.'
    );
  });

  it('flags small samples and quit-dominated levels', () => {
    const levels = [
      level({ level: 1, plays: 10, completed: 8, failed: 2, completionRate: 0.8 }),
      level({ level: 2, plays: 3, completed: 0, failed: 1, quit: 2, completionRate: 0 })
    ];
    expect(describeLevelDifficulty(levels)).toBe(
      'Level 2 is the hardest so far: 0% of 3 plays (a small sample) completed, against 80% of 10 plays on level 1. Most of its unfinished runs end with the player quitting.'
    );
  });

  it('does not compare when there is nothing to compare', () => {
    expect(describeLevelDifficulty([])).toBeNull();
    expect(describeLevelDifficulty([level({ level: 1, plays: 2, completed: 2, completionRate: 1 })])).toBe(
      'Only level 1 has finished plays so far, so levels cannot be compared yet.'
    );
    expect(
      describeLevelDifficulty([
        level({ level: 1, plays: 2, completed: 1, failed: 1, completionRate: 0.5 }),
        level({ level: 2, plays: 4, completed: 2, quit: 2, completionRate: 0.5 })
      ])
    ).toBe('Every level has the same completion rate (50%).');
  });
});
