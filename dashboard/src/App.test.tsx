import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DashboardData } from './api/analytics';
import { ApiError } from './api/analytics';
import { App } from './App';
import { emptyOverview, level, populated } from './testData';

afterEach(cleanup);

const loader = (...results: (DashboardData | Error)[]) => {
  const load = vi.fn(async () => {
    const next = results.length > 1 ? results.shift()! : results[0];
    if (next instanceof Error) throw next;
    return next;
  });
  return load;
};

const pending = () => vi.fn(() => new Promise<DashboardData>(() => {}));

describe('dashboard', () => {
  it('shows a loading state until the data arrives', () => {
    render(<App load={pending()} />);
    expect(screen.getByRole('heading', { name: 'Loading gameplay analytics…' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Connecting');
    expect(screen.queryByTestId('completion-rate')).toBeNull();
  });

  it('shows the overview from /api/analytics/overview with human-readable values', async () => {
    render(<App load={loader(populated)} />);
    expect((await screen.findByTestId('completion-rate')).textContent).toBe('45%');
    expect(screen.getByTestId('total-plays').textContent).toBe('47 plays');

    const legend = document.querySelector('.outcome-legend')!.textContent!;
    expect(legend).toContain('Completed21 · 45%');
    expect(legend).toContain('Failed19 · 40%');
    expect(legend).toContain('Quit7 · 15%');

    const strip = document.querySelector('.stat-strip')!.textContent!;
    expect(strip).toContain('37%'); // unfinished runs
    expect(strip).toContain('65%'); // average progress
    expect(strip).toContain('14.5 s');
    expect(strip).toContain('92');
    // No raw floating-point values leak into the page.
    expect(document.body.textContent).not.toMatch(/\d\.\d{3,}/);
  });

  it('shows one row per level from /api/analytics/levels', async () => {
    render(<App load={loader(populated)} />);
    const row3 = within(await screen.findByTestId('level-row-3'));
    expect(row3.getByText('Level 3')).toBeTruthy();
    expect(row3.getByText('13 plays')).toBeTruthy();
    expect(row3.getByText('23%')).toBeTruthy();
    expect(row3.getByRole('img').getAttribute('aria-label')).toBe(
      'Level 3 outcomes: Completed 3 (23%), Failed 6 (46%), Quit 4 (31%)'
    );
    // Segment widths are proportional to the counts.
    const widths = [...document.querySelectorAll('[data-testid="level-row-3"] .outcome-bar__segment')].map(
      (segment) => (segment as HTMLElement).style.flexGrow
    );
    expect(widths).toEqual(['3', '6', '4']);

    expect(screen.getByTestId('detail-row-1').textContent).toBe('Level 145%14.4 s38181071');
    expect(screen.getByTestId('level-insight').textContent).toContain('Level 3 is the hardest so far');
  });

  it('shows an empty state instead of empty charts when no plays are recorded', async () => {
    render(<App load={loader({ overview: emptyOverview, levels: [] })} />);
    expect(await screen.findByText('No gameplay sessions recorded yet.')).toBeTruthy();
    expect(screen.getByText(/Play Neon Snake to generate analytics/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the game' })).toBeTruthy();
    expect(document.querySelector('.outcome-bar')).toBeNull();
    expect(screen.queryByTestId('completion-rate')).toBeNull();
  });

  it('shows the unavailable state when the backend cannot be reached, and retries', async () => {
    const load = loader(new ApiError('The analytics backend could not be reached.'), populated);
    render(<App load={load} />);
    expect(await screen.findByText('The analytics backend is unavailable')).toBeTruthy();
    expect(screen.getByText('The analytics backend could not be reached.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Local analytics backend unavailable');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect((await screen.findByTestId('completion-rate')).textContent).toBe('45%');
  });

  it('keeps the last data on screen when a refresh fails', async () => {
    render(<App load={loader(populated, new ApiError('The analytics backend responded with HTTP 502.'))} />);
    await screen.findByTestId('completion-rate');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await vi.waitFor(() => expect(screen.getByRole('status').textContent).toContain('Backend unavailable · showing data from'));
    expect(screen.getByTestId('completion-rate').textContent).toBe('45%');
  });

  it('handles null aggregates and missing outcomes without breaking', async () => {
    const allCompleted: DashboardData = {
      overview: {
        ...emptyOverview,
        totalPlays: 2,
        completedPlays: 2,
        completionRate: 1,
        averageScore: 50,
        averageProgress: 1,
        averageDurationMs: 9100
      },
      levels: [
        level({ level: 1, plays: 2, completed: 2, completionRate: 1, averageScore: 50, averageProgress: 1, averageDurationMs: 9100 })
      ]
    };
    render(<App load={loader(allCompleted)} />);
    expect((await screen.findByTestId('completion-rate')).textContent).toBe('100%');
    expect(document.querySelector('.stat-strip')!.textContent).toContain('— no unfinished runs');
    expect(screen.getByTestId('detail-row-1').textContent).toContain('— every play completed');
    // Zero-count outcomes draw no segment; the legend still lists them.
    expect(document.querySelectorAll('[data-testid="level-row-1"] .outcome-bar__segment')).toHaveLength(1);
    expect(document.querySelector('.outcome-legend')!.textContent).toContain('Quit0 · 0%');
    expect(screen.getByText(/small sample/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/NaN|undefined|null|Infinity/);
  });
});
