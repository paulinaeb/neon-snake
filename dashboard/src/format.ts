// Human-readable values. Missing values (null) render as an em dash.

const MISSING = '—';

export const formatCount = (value: number): string => value.toLocaleString('en-US');

// 0.4468 → "45%". Non-zero shares that would round to 0% or 100% stay distinguishable.
export const formatPercent = (share: number | null): string => {
  if (share === null || !Number.isFinite(share)) return MISSING;
  if (share > 0 && share < 0.005) return '<1%';
  if (share < 1 && share > 0.995) return '>99%';
  return `${Math.round(share * 100)}%`;
};

// 14511.8 → "14.5 s"; 75000 → "1 min 15 s".
export const formatDuration = (ms: number | null): string => {
  if (ms === null || !Number.isFinite(ms)) return MISSING;
  const tenths = Math.round(ms / 100) / 10;
  if (tenths < 60) return `${tenths.toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
};

export const formatScore = (score: number | null): string =>
  score === null || !Number.isFinite(score) ? MISSING : formatCount(Math.round(score));

export const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;

export const share = (part: number, total: number): number | null => (total > 0 ? part / total : null);
