// Client for the analytics backend's read API (server/src/app.ts). Rates and progress are 0–1;
// averages are null when there are no plays to average.

export type Outcome = 'complete' | 'fail' | 'quit';

export type Overview = {
  totalPlays: number;
  completedPlays: number;
  failedPlays: number;
  quitPlays: number;
  completionRate: number | null;
  averageScore: number | null;
  averageProgress: number | null;
  averageUnfinishedProgress: number | null;
  averageDurationMs: number | null;
};

export type LevelMetrics = {
  level: number;
  plays: number;
  completed: number;
  failed: number;
  quit: number;
  completionRate: number | null;
  averageScore: number | null;
  averageProgress: number | null;
  averageUnfinishedProgress: number | null;
  averageDurationMs: number | null;
};

export type DashboardData = {
  overview: Overview;
  levels: LevelMetrics[];
};

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const getJson = async <T>(path: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<T> => {
  let response: Response;
  try {
    response = await fetchImpl(path, { headers: { Accept: 'application/json' }, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('The analytics backend could not be reached.');
  }
  if (!response.ok) throw new ApiError(`The analytics backend responded with HTTP ${response.status}.`);
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError('The analytics backend returned an unreadable response.');
  }
};

export const fetchDashboardData = async (
  signal?: AbortSignal,
  fetchImpl: typeof fetch = (...args) => fetch(...args)
): Promise<DashboardData> => {
  const [overview, levels] = await Promise.all([
    getJson<Overview>('/api/analytics/overview', fetchImpl, signal),
    getJson<LevelMetrics[]>('/api/analytics/levels', fetchImpl, signal)
  ]);
  return { overview, levels };
};
