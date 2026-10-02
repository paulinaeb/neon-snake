import type { AnalyticsEvent } from './events';

// Delivers batches of events. Replaceable without touching gameplay code.
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

export const ANALYTICS_ENDPOINT = '/api/analytics/events';

// Posts each batch to the analytics backend as { events }. Delivery is best effort: a failed request
// rejects (reported by Analytics), is not retried, and never blocks gameplay. `keepalive` lets the
// last batch finish when the page is closing; the timeout bounds requests to an unresponsive backend.
export class HttpTransport implements AnalyticsTransport {
  constructor(
    private readonly endpoint: string = ANALYTICS_ENDPOINT,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly timeoutMs = 5000
  ) {}

  async send(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0) return;
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    if (!response.ok) throw new Error(`Analytics backend responded with HTTP ${response.status}`);
  }
}

// Sends every batch to several transports; rejects if any of them fails.
export const combineTransports = (...transports: AnalyticsTransport[]): AnalyticsTransport => ({
  send: async (events) => {
    await Promise.all(transports.map((transport) => transport.send(events)));
  }
});

declare global {
  interface Window {
    // Development builds only.
    __neonSnakeAnalytics?: MemoryTransport;
  }
}
