import type { ReactNode } from 'react';

const GAME_URL: string = import.meta.env.VITE_GAME_URL || 'http://localhost:5173/';

// A small snake heading for a fruit: the game's own picture for "nothing has happened yet".
const SnakeGlyph = ({ moving = false }: { moving?: boolean }) => (
  <span className={`snake-glyph${moving ? ' snake-glyph--moving' : ''}`} aria-hidden="true">
    <span />
    <span />
    <span />
    <span />
    <span className="snake-glyph__fruit" />
  </span>
);

const StatePanel = ({ title, children, moving }: { title: string; children?: ReactNode; moving?: boolean }) => (
  <section className="state-panel" aria-live="polite">
    <SnakeGlyph moving={moving} />
    <h2>{title}</h2>
    {children}
  </section>
);

export const LoadingState = () => <StatePanel title="Loading gameplay analytics…" moving />;

export const UnavailableState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <StatePanel title="The analytics backend is unavailable">
    <p>{message}</p>
    <p>
      The dashboard reads from the local backend at <code>/api/analytics</code>. Start the emulator and backend with{' '}
      <code>pnpm dev:all</code> (or <code>pnpm emulators</code> and <code>pnpm dev:server</code>), then try again.
    </p>
    <div className="state-panel__actions">
      <button className="button button--primary" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  </StatePanel>
);

export const EmptyState = ({ onRefresh }: { onRefresh: () => void }) => (
  <StatePanel title="No gameplay sessions recorded yet.">
    <p>Play Neon Snake to generate analytics. A play counts once it ends: completed, failed or quit.</p>
    <div className="state-panel__actions">
      <a className="button button--primary" href={GAME_URL} target="_blank" rel="noreferrer">
        Open the game
      </a>
      <button className="button" type="button" onClick={onRefresh}>
        Check again
      </button>
    </div>
  </StatePanel>
);
