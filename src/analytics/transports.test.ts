import { describe, expect, it, vi } from 'vitest';

import { Analytics } from './Analytics';
import type { AnalyticsEvent } from './events';
import { ANALYTICS_ENDPOINT, combineTransports, HttpTransport, MemoryTransport } from './transports';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const start: AnalyticsEvent = {
  type: 'gameplay_start',
  playId: '6f1c2a9e-3b4d-4f5a-9c8b-7d6e5f4a3b2c',
  level: 1,
  timestamp: '2026-10-02T10:00:00.000Z'
};

const respond = (status: number) => vi.fn<typeof fetch>(async () => new Response(null, { status }));

describe('HttpTransport', () => {
  it('posts the batch as JSON to the analytics endpoint', async () => {
    const fetchImpl = respond(201);
    await new HttpTransport(undefined, fetchImpl).send([start]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(ANALYTICS_ENDPOINT);
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init?.body as string)).toEqual({ events: [start] });
  });

  it('rejects when the backend answers with an error status', async () => {
    await expect(new HttpTransport(undefined, respond(400)).send([start])).rejects.toThrow('HTTP 400');
    await expect(new HttpTransport(undefined, respond(502)).send([start])).rejects.toThrow('HTTP 502');
  });

  it('rejects when the backend is unreachable', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(new HttpTransport(undefined, fetchImpl).send([start])).rejects.toThrow('Failed to fetch');
  });

  it('does not send empty batches', async () => {
    const fetchImpl = respond(201);
    await new HttpTransport(undefined, fetchImpl).send([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('gives up on a backend that does not answer', async () => {
    const hanging = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))
    );
    await expect(new HttpTransport(undefined, hanging, 20).send([start])).rejects.toThrow();
  });
});

describe('analytics over HTTP', () => {
  it('tracks without throwing or waiting while the backend is down, and reports the failure', async () => {
    const errors: unknown[] = [];
    const neverAnswers = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const failing = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });

    const hanging = new Analytics(new HttpTransport(undefined, neverAnswers));
    expect(() => hanging.track(start)).not.toThrow();
    await settle();
    expect(neverAnswers).toHaveBeenCalledTimes(1);

    const analytics = new Analytics(new HttpTransport(undefined, failing), (error) => errors.push(error));
    expect(() => analytics.track(start)).not.toThrow();
    await settle();
    expect(errors).toEqual([expect.any(TypeError)]);
  });

  it('keeps recording in memory when the HTTP delivery fails', async () => {
    const memory = new MemoryTransport();
    const http = new HttpTransport(undefined, respond(503));
    await expect(combineTransports(http, memory).send([start])).rejects.toThrow('HTTP 503');
    expect(memory.events).toEqual([start]);
  });
});
