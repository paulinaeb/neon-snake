import { describe, expect, it } from 'vitest';

import { computeLevels, computeOverview, type PlayOutcome } from '../src/analytics/aggregate';

let nextId = 0;
const outcome = (overrides: Partial<PlayOutcome>): PlayOutcome => ({
  playId: `play-${(nextId += 1)}`,
  level: 1,
  result: 'complete',
  score: 50,
  progress: 1,
  durationMs: 10000,
  occurredAt: new Date('2026-10-02T10:00:00.000Z'),
  ...overrides
});

describe('aggregation', () => {
  const outcomes = [
    outcome({ level: 1, result: 'complete', score: 50, progress: 1, durationMs: 20000 }),
    outcome({ level: 1, result: 'fail', score: 10, progress: 0.2, durationMs: 5000 }),
    outcome({ level: 2, result: 'quit', score: 70, progress: 0.4, durationMs: 9000 }),
    outcome({ level: 2, result: 'complete', score: 110, progress: 1, durationMs: 30000 })
  ];

  it('computes the overview over all finished plays', () => {
    expect(computeOverview(outcomes)).toEqual({
      totalPlays: 4,
      completedPlays: 2,
      failedPlays: 1,
      quitPlays: 1,
      completionRate: 0.5,
      averageScore: 60,
      averageProgress: expect.closeTo(0.65, 10),
      averageDurationMs: 16000
    });
  });

  it('computes metrics per level, ordered by level', () => {
    expect(computeLevels([outcomes[3], outcomes[0], outcomes[2], outcomes[1]])).toEqual([
      {
        level: 1,
        plays: 2,
        completed: 1,
        failed: 1,
        quit: 0,
        completionRate: 0.5,
        averageScore: 30,
        averageProgress: 0.6,
        averageDurationMs: 12500
      },
      {
        level: 2,
        plays: 2,
        completed: 1,
        failed: 0,
        quit: 1,
        completionRate: 0.5,
        averageScore: 90,
        averageProgress: 0.7,
        averageDurationMs: 19500
      }
    ]);
  });

  it('counts a play once when its gameplay_end was stored twice', () => {
    const first = outcome({ playId: 'same', result: 'fail', occurredAt: new Date('2026-10-02T10:00:00.000Z') });
    const duplicate = { ...first, result: 'complete' as const, occurredAt: new Date('2026-10-02T10:00:01.000Z') };
    expect(computeOverview([duplicate, first])).toMatchObject({ totalPlays: 1, failedPlays: 1, completedPlays: 0 });
  });
});
