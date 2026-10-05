type MastheadProps = {
  status: 'loading' | 'ok' | 'error';
  updatedAt: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
};

const time = (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const statusText = ({ status, updatedAt }: Pick<MastheadProps, 'status' | 'updatedAt'>): string => {
  if (status === 'loading') return 'Connecting to the local analytics backend…';
  if (status === 'error') {
    return updatedAt ? `Backend unavailable · showing data from ${time(updatedAt)}` : 'Local analytics backend unavailable';
  }
  return `Local analytics backend · updated ${updatedAt ? time(updatedAt) : ''}`;
};

export const Masthead = ({ status, updatedAt, refreshing, onRefresh }: MastheadProps) => (
  <header className="masthead">
    <div className="masthead__identity">
      <p className="brand">
        <span className="brand-mark" aria-hidden="true" />
        Neon Snake
      </p>
      <h1>Gameplay analytics</h1>
    </div>
    <div className="masthead__source">
      <p className="source" role="status" data-status={status}>
        <span className="source__dot" aria-hidden="true" />
        {statusText({ status, updatedAt })}
      </p>
      <button className="button" type="button" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  </header>
);
