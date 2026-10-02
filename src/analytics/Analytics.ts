import type { AnalyticsEvent } from './events';
import type { AnalyticsTransport } from './transports';

// Best-effort event tracking: track() never throws and never blocks the caller. Events tracked in the
// same task are sent together in one batch.
export class Analytics {
  private queue: AnalyticsEvent[] = [];
  private flushScheduled = false;

  constructor(
    private readonly transport: AnalyticsTransport,
    private readonly onError: (error: unknown) => void = () => {}
  ) {}

  track(event: AnalyticsEvent): void {
    this.queue.push(event);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.flushScheduled = false;
    const batch = this.queue;
    this.queue = [];
    try {
      this.transport.send(batch).catch((error: unknown) => this.reportError(error));
    } catch (error) {
      this.reportError(error);
    }
  }

  private reportError(error: unknown): void {
    try {
      this.onError(error);
    } catch {
      // Analytics must never affect gameplay.
    }
  }
}
