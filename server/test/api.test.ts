import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AnalyticsEvent as GameAnalyticsEvent } from '../../src/analytics/events';
import type { AnalyticsEvent } from '../src/analytics/schema';
import { MAX_BATCH_SIZE } from '../src/analytics/schema';
import type { AnalyticsStore } from '../src/analytics/store';
import { createApp } from '../src/app';
import { gameplayEnd, gameplayStart, MemoryStore, play, scoreChange } from './fixtures';

// Compile-time contract: the game's event type and the backend schema accept the same events.
const toBackend = (event: GameAnalyticsEvent): AnalyticsEvent => event;
const toGame = (event: AnalyticsEvent): GameAnalyticsEvent => event;
void toBackend;
void toGame;

const setup = (store: AnalyticsStore = new MemoryStore()) => {
  const app = createApp(store, () => {});
  const post = (body: unknown) => request(app).post('/api/analytics/events').send(body as object);
  return { app, store, post };
};

const expectRejected = async (events: unknown[], path?: string) => {
  const store = new MemoryStore();
  const res = await setup(store).post({ events });
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('invalid_events');
  if (path) expect(res.body.error.issues.map((issue: { path: string }) => issue.path)).toContain(path);
  expect(store.events).toHaveLength(0);
  return res;
};

describe('POST /api/analytics/events', () => {
  it('accepts a valid batch and stores every event', async () => {
    const store = new MemoryStore();
    const events = [gameplayStart(), scoreChange(), gameplayEnd()];
    const res = await setup(store).post({ events });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ accepted: 3 });
    expect(store.events).toEqual(events);
  });

  it.each(['complete', 'fail', 'quit'])('accepts gameplay_end with result "%s"', async (result) => {
    const res = await setup().post({ events: [gameplayEnd({ result })] });
    expect(res.status).toBe(201);
  });

  it('accepts progress and duration at their bounds', async () => {
    const res = await setup().post({
      events: [scoreChange({ progress: 0, score: 0 }), gameplayEnd({ progress: 1, durationMs: 0 })]
    });
    expect(res.status).toBe(201);
  });

  it('rejects a malformed event', async () => {
    await expectRejected([{ type: 'gameplay_start' }], 'events.0.playId');
    await expectRejected(['not an event']);
    await expectRejected([gameplayEnd({ score: undefined })], 'events.0.score');
  });

  it('rejects an unknown event type', async () => {
    await expectRejected([gameplayStart({ type: 'level_up' })], 'events.0.type');
  });

  it('rejects an invalid playId', async () => {
    await expectRejected([gameplayStart({ playId: 'run-1' })], 'events.0.playId');
    await expectRejected([gameplayStart({ playId: 42 })], 'events.0.playId');
  });

  it('rejects a level that is not a positive integer', async () => {
    for (const level of [0, -1, 1.5, '1']) await expectRejected([gameplayStart({ level })], 'events.0.level');
  });

  it('rejects an invalid timestamp', async () => {
    for (const timestamp of ['yesterday', '2026-10-02', 1759399200000, '2026-13-02T10:00:00.000Z']) {
      await expectRejected([gameplayStart({ timestamp })], 'events.0.timestamp');
    }
  });

  it('rejects progress outside 0–1', async () => {
    await expectRejected([scoreChange({ progress: 1.2 })], 'events.0.progress');
    await expectRejected([gameplayEnd({ progress: -0.1 })], 'events.0.progress');
  });

  it('rejects non-numeric or non-finite values', async () => {
    await expectRejected([scoreChange({ score: '10' })], 'events.0.score');
    await expectRejected([scoreChange({ score: -10 })], 'events.0.score');
    // JSON has no Infinity/NaN; JSON.stringify sends them as null.
    await expectRejected([gameplayEnd({ durationMs: Number.POSITIVE_INFINITY })], 'events.0.durationMs');
    await expectRejected([scoreChange({ progress: Number.NaN })], 'events.0.progress');
  });

  it('rejects an unknown gameplay_end result', async () => {
    await expectRejected([gameplayEnd({ result: 'win' })], 'events.0.result');
  });

  it('rejects a negative duration', async () => {
    await expectRejected([gameplayEnd({ durationMs: -1 })], 'events.0.durationMs');
  });

  it('rejects unknown fields instead of storing them', async () => {
    await expectRejected([gameplayStart({ userEmail: 'player@example.com' })]);
  });

  it('rejects the whole batch when one event is invalid', async () => {
    const res = await expectRejected([...play({}), gameplayEnd({ result: 'win' })], 'events.3.result');
    expect(res.body.error.issues).toHaveLength(1);
  });

  it('rejects an empty, missing or oversized batch', async () => {
    await expectRejected([]);
    const store = new MemoryStore();
    expect((await setup(store).post({})).status).toBe(400);
    expect((await setup(store).post([gameplayStart()])).status).toBe(400);

    const oversized = Array.from({ length: MAX_BATCH_SIZE + 1 }, () => gameplayStart());
    await expectRejected(oversized, 'events');
    expect((await setup(store).post({ events: oversized.slice(0, MAX_BATCH_SIZE) })).status).toBe(201);
  });

  it('rejects a request body above the size limit', async () => {
    const res = await setup().post({ events: [gameplayStart({ padding: 'x'.repeat(70_000) })] });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });

  it('rejects invalid JSON and non-JSON bodies without exposing internals', async () => {
    const { app } = setup();
    const invalid = await request(app)
      .post('/api/analytics/events')
      .set('Content-Type', 'application/json')
      .send('{"events": [');
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ error: { code: 'invalid_json', message: 'Request body is not valid JSON.' } });

    const text = await request(app).post('/api/analytics/events').set('Content-Type', 'text/plain').send('hello');
    expect(text.status).toBe(415);
  });

  it('returns a generic 500 when storage fails', async () => {
    const failing: AnalyticsStore = {
      saveEvents: async () => {
        throw new Error('emulator down at /secret/path');
      },
      listPlayOutcomes: async () => []
    };
    const res = await setup(failing).post({ events: [gameplayStart()] });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'internal_error', message: 'Internal server error.' } });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});

describe('read API', () => {
  it('returns empty metrics when there are no plays', async () => {
    const { app } = setup();
    const overview = await request(app).get('/api/analytics/overview');
    expect(overview.status).toBe(200);
    expect(overview.body).toEqual({
      totalPlays: 0,
      completedPlays: 0,
      failedPlays: 0,
      quitPlays: 0,
      completionRate: null,
      averageScore: null,
      averageProgress: null,
      averageUnfinishedProgress: null,
      averageDurationMs: null
    });
    expect((await request(app).get('/api/analytics/levels')).body).toEqual([]);
  });

  it('answers unknown API routes with JSON 404', async () => {
    const res = await request(setup().app).get('/api/analytics/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
