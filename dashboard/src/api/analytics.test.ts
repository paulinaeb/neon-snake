import { describe, expect, it, vi } from 'vitest';

import { populated } from '../testData';
import { ApiError, fetchDashboardData } from './analytics';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('fetchDashboardData', () => {
  it('reads the overview and levels endpoints through the /api proxy', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (url) =>
      json(String(url).endsWith('/overview') ? populated.overview : populated.levels)
    );
    await expect(fetchDashboardData(undefined, fetchImpl)).resolves.toEqual(populated);
    expect(fetchImpl.mock.calls.map(([url]) => url).sort()).toEqual(['/api/analytics/levels', '/api/analytics/overview']);
  });

  it('reports an unreachable backend', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(fetchDashboardData(undefined, fetchImpl)).rejects.toThrow(
      new ApiError('The analytics backend could not be reached.')
    );
  });

  it('reports error statuses, e.g. the Vite proxy answering 502 when the backend is down', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('Bad Gateway', { status: 502 }));
    await expect(fetchDashboardData(undefined, fetchImpl)).rejects.toThrow('HTTP 502');
  });

  it('reports a response that is not JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('<html>', { status: 200 }));
    await expect(fetchDashboardData(undefined, fetchImpl)).rejects.toThrow('unreadable response');
  });
});
