import type { GameEventMap } from '../application/gameEvents';
import type { EventBus } from '../core/events/EventBus';
import type { Analytics } from './Analytics';
import type { AnalyticsEvent } from './events';

const isoTimestamp = (epochMs: number): string => new Date(epochMs).toISOString();

// Maps the controller's run events to analytics events. The controller decides when a run starts,
// changes, and ends; this module only translates, so it holds no gameplay state of its own.
export const connectGameplayAnalytics = (events: EventBus<GameEventMap>, analytics: Analytics): (() => void) => {
  const safely =
    <Payload>(toEvent: (payload: Payload) => AnalyticsEvent) =>
    (payload: Payload): void => {
      try {
        analytics.track(toEvent(payload));
      } catch {
        // Analytics must never affect gameplay.
      }
    };

  const unsubscribers = [
    events.on(
      'runStarted',
      safely(({ runId, level, occurredAt }) => ({
        type: 'gameplay_start',
        playId: runId,
        level,
        timestamp: isoTimestamp(occurredAt)
      }))
    ),
    events.on(
      'runUpdated',
      safely(({ runId, level, score, progress, occurredAt }) => ({
        type: 'score_change',
        playId: runId,
        level,
        score,
        progress,
        timestamp: isoTimestamp(occurredAt)
      }))
    ),
    events.on(
      'runEnded',
      safely(({ runId, level, reason, score, progress, durationMs, occurredAt }) => ({
        type: 'gameplay_end',
        playId: runId,
        level,
        result: reason,
        score,
        progress,
        durationMs,
        timestamp: isoTimestamp(occurredAt)
      }))
    )
  ];

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};
