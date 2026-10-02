import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EVENTS_COLLECTION, FirestoreAnalyticsStore } from '../src/analytics/store';
import { createApp } from '../src/app';
import { connectFirestoreEmulator } from '../src/firestore';
import { gameplayEnd, gameplayStart, play, scoreChange } from './fixtures';

// Runs against the Firestore Emulator started by `pnpm test` (firebase emulators:exec), in its own
// demo project so it never touches data from the development emulator.
const PROJECT_ID = 'demo-neon-snake-test';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulatorHost) {
  throw new Error('FIRESTORE_EMULATOR_HOST is not set. Run the backend tests with "pnpm test:server".');
}

let db: Firestore;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;

const storedEvents = async () => (await db.collection(EVENTS_COLLECTION).get()).docs;

beforeAll(() => {
  ({ db, close } = connectFirestoreEmulator({ projectId: PROJECT_ID, firestoreEmulatorHost: emulatorHost }, 'test'));
  app = createApp(new FirestoreAnalyticsStore(db), () => {});
});

beforeEach(async () => {
  const res = await fetch(`http://${emulatorHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, {
    method: 'DELETE'
  });
  expect(res.ok).toBe(true);
});

afterAll(async () => {
  await close();
});

describe('Firestore Emulator persistence', () => {
  it('stores each event of a valid batch as its own document with native fields', async () => {
    const start = gameplayStart();
    const change = scoreChange({ playId: start.playId });
    const end = gameplayEnd({ playId: start.playId, result: 'fail', score: 10, progress: 0.2, durationMs: 4200 });
    const before = Date.now();

    const res = await request(app).post('/api/analytics/events').send({ events: [start, change, end] });
    expect(res.status).toBe(201);

    const docs = await storedEvents();
    expect(docs).toHaveLength(3);
    // Generated document IDs, never the playId.
    expect(docs.every((doc) => doc.id !== start.playId && doc.id.length === 20)).toBe(true);

    const byType: Record<string, FirebaseFirestore.DocumentData> = Object.fromEntries(
      docs.map((doc) => [doc.get('type'), doc.data()])
    );
    expect(byType.gameplay_end).toMatchObject({
      type: 'gameplay_end',
      playId: start.playId,
      level: 1,
      result: 'fail',
      score: 10,
      progress: 0.2,
      durationMs: 4200
    });
    expect(byType.score_change).toMatchObject({ playId: start.playId, score: 10, progress: 0.2 });
    expect(Object.keys(byType.gameplay_start).sort()).toEqual(['level', 'playId', 'receivedAt', 'timestamp', 'type']);

    for (const data of Object.values(byType)) {
      // Original gameplay time, kept as a native timestamp.
      expect(data.timestamp).toBeInstanceOf(Timestamp);
      // Server-side receipt time.
      expect(data.receivedAt).toBeInstanceOf(Timestamp);
      expect(data.receivedAt.toMillis()).toBeGreaterThanOrEqual(before - 5000);
    }
    expect(byType.gameplay_end.timestamp.toDate().toISOString()).toBe(end.timestamp);
  });

  it('stores nothing when one event in the batch is invalid', async () => {
    const res = await request(app)
      .post('/api/analytics/events')
      .send({ events: [gameplayStart(), gameplayEnd({ durationMs: -5 })] });
    expect(res.status).toBe(400);
    expect(await storedEvents()).toHaveLength(0);
  });

  it('aggregates stored plays for the overview and per level', async () => {
    const events = [
      ...play({ level: 1, result: 'complete', score: 50, progress: 1, durationMs: 20000 }),
      ...play({ level: 1, result: 'fail', score: 10, progress: 0.2, durationMs: 4000 }),
      ...play({ level: 2, result: 'quit', score: 70, progress: 0.4, durationMs: 9000 }),
      // A play that has started but not ended is not counted.
      gameplayStart({ level: 3 })
    ];
    expect((await request(app).post('/api/analytics/events').send({ events })).status).toBe(201);

    const overview = await request(app).get('/api/analytics/overview');
    expect(overview.status).toBe(200);
    expect(overview.body).toEqual({
      totalPlays: 3,
      completedPlays: 1,
      failedPlays: 1,
      quitPlays: 1,
      completionRate: 1 / 3,
      averageScore: 130 / 3,
      averageProgress: expect.closeTo(1.6 / 3, 10),
      averageDurationMs: 11000
    });

    const levels = await request(app).get('/api/analytics/levels');
    expect(levels.status).toBe(200);
    expect(levels.body).toEqual([
      {
        level: 1,
        plays: 2,
        completed: 1,
        failed: 1,
        quit: 0,
        completionRate: 0.5,
        averageScore: 30,
        averageProgress: 0.6,
        averageDurationMs: 12000
      },
      {
        level: 2,
        plays: 1,
        completed: 0,
        failed: 0,
        quit: 1,
        completionRate: 0,
        averageScore: 70,
        averageProgress: 0.4,
        averageDurationMs: 9000
      }
    ]);
  });
});
