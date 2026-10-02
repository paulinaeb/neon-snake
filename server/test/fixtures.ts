import { randomUUID } from 'node:crypto';

import type { PlayOutcome } from '../src/analytics/aggregate';
import type { AnalyticsEvent } from '../src/analytics/schema';
import type { AnalyticsStore } from '../src/analytics/store';

export const gameplayStart = (overrides: Record<string, unknown> = {}) => ({
  type: 'gameplay_start',
  playId: randomUUID(),
  level: 1,
  timestamp: '2026-10-02T10:00:00.000Z',
  ...overrides
});

export const scoreChange = (overrides: Record<string, unknown> = {}) => ({
  type: 'score_change',
  playId: randomUUID(),
  level: 1,
  score: 10,
  progress: 0.2,
  timestamp: '2026-10-02T10:00:03.000Z',
  ...overrides
});

export const gameplayEnd = (overrides: Record<string, unknown> = {}) => ({
  type: 'gameplay_end',
  playId: randomUUID(),
  level: 1,
  result: 'complete',
  score: 50,
  progress: 1,
  durationMs: 15000,
  timestamp: '2026-10-02T10:00:15.000Z',
  ...overrides
});

// A play as the game sends it: start, score changes, end, all sharing one playId.
export const play = (end: Record<string, unknown>) => {
  const playId = randomUUID();
  return [gameplayStart({ playId, level: end.level ?? 1 }), scoreChange({ playId, level: end.level ?? 1 }), gameplayEnd({ ...end, playId })];
};

export class MemoryStore implements AnalyticsStore {
  readonly events: AnalyticsEvent[] = [];
  async saveEvents(events: AnalyticsEvent[]) {
    this.events.push(...events);
  }
  async listPlayOutcomes(): Promise<PlayOutcome[]> {
    return this.events.flatMap((event) =>
      event.type === 'gameplay_end' ? [{ ...event, occurredAt: new Date(event.timestamp) }] : []
    );
  }
}
