import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

import type { PlayOutcome } from './aggregate';
import type { AnalyticsEvent } from './schema';

export const EVENTS_COLLECTION = 'analyticsEvents';

export interface AnalyticsStore {
  // Stores all events or none.
  saveEvents(events: AnalyticsEvent[]): Promise<void>;
  listPlayOutcomes(): Promise<PlayOutcome[]>;
}

// Raw events are the source of truth: one document per event with a generated ID, fields stored
// natively. `timestamp` is when the gameplay activity happened (client clock); `receivedAt` is when
// the backend stored it (server clock).
export class FirestoreAnalyticsStore implements AnalyticsStore {
  constructor(private readonly db: Firestore) {}

  async saveEvents(events: AnalyticsEvent[]): Promise<void> {
    const collection = this.db.collection(EVENTS_COLLECTION);
    const batch = this.db.batch();
    for (const event of events) {
      batch.create(collection.doc(), {
        ...event,
        timestamp: Timestamp.fromDate(new Date(event.timestamp)),
        receivedAt: FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
  }

  async listPlayOutcomes(): Promise<PlayOutcome[]> {
    const snapshot = await this.db
      .collection(EVENTS_COLLECTION)
      .where('type', '==', 'gameplay_end')
      .select('playId', 'level', 'result', 'score', 'progress', 'durationMs', 'timestamp')
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        playId: data.playId,
        level: data.level,
        result: data.result,
        score: data.score,
        progress: data.progress,
        durationMs: data.durationMs,
        occurredAt: (data.timestamp as Timestamp).toDate()
      };
    });
  }
}
