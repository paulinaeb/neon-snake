import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchDashboardData, type DashboardData } from './analytics';

export type DashboardState = {
  data: DashboardData | null;
  error: Error | null;
  loading: boolean;
  updatedAt: Date | null;
  refresh: () => void;
};

// Loads the dashboard data on mount and on refresh. A failed refresh keeps the last good data so
// the page does not blank out; the error is reported alongside it.
export const useDashboardData = (load: typeof fetchDashboardData = fetchDashboardData): DashboardState => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [requestId, setRequestId] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadRef
      .current(controller.signal)
      .then((next) => {
        setData(next);
        setError(null);
        setUpdatedAt(new Date());
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason : new Error(String(reason)));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestId]);

  const refresh = useCallback(() => setRequestId((id) => id + 1), []);

  return { data, error, loading, updatedAt, refresh };
};
