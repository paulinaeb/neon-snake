import type { AnalyticsEvent } from './events';

// Delivers batches of events. Replaceable without touching gameplay code, e.g. by an HTTP transport
// posting to the analytics backend.
export interface AnalyticsTransport {
  send(events: AnalyticsEvent[]): Promise<void>;
}

export const noopTransport: AnalyticsTransport = {
  send: async () => {}
};

// Keeps events in memory for local inspection, e.g. window.__neonSnakeAnalytics.events in development.
export class MemoryTransport implements AnalyticsTransport {
  readonly events: AnalyticsEvent[] = [];

  constructor(private readonly onSend?: (events: AnalyticsEvent[]) => void) {}

  async send(events: AnalyticsEvent[]): Promise<void> {
    this.events.push(...events);
    this.onSend?.(events);
  }
}

declare global {
  interface Window {
    // Development builds only.
    __neonSnakeAnalytics?: MemoryTransport;
  }
}
