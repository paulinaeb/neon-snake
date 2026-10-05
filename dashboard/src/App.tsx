import { fetchDashboardData } from './api/analytics';
import { useDashboardData } from './api/useDashboardData';
import { LevelDetail } from './components/LevelDetail';
import { LevelDifficulty } from './components/LevelDifficulty';
import { Masthead } from './components/Masthead';
import { Overview } from './components/Overview';
import { EmptyState, LoadingState, UnavailableState } from './components/StatePanel';

export const App = ({ load = fetchDashboardData }: { load?: typeof fetchDashboardData }) => {
  const { data, error, loading, updatedAt, refresh } = useDashboardData(load);
  const status = error ? 'error' : data ? 'ok' : 'loading';

  const content = () => {
    if (!data) {
      return error ? <UnavailableState message={error.message} onRetry={refresh} /> : <LoadingState />;
    }
    if (data.overview.totalPlays === 0) return <EmptyState onRefresh={refresh} />;
    return (
      <>
        <Overview overview={data.overview} />
        <LevelDifficulty levels={data.levels} />
        <LevelDetail levels={data.levels} />
      </>
    );
  };

  return (
    <div className="page">
      <Masthead status={status} updatedAt={updatedAt} refreshing={loading && data !== null} onRefresh={refresh} />
      <main className="content" aria-busy={loading} data-refreshing={loading && data !== null}>
        {content()}
      </main>
      <footer className="page-footer">
        Source: finished plays recorded by the local analytics backend, read from{' '}
        <code>GET /api/analytics/overview</code> and <code>GET /api/analytics/levels</code>.
      </footer>
    </div>
  );
};
