import { describe, expect, it } from 'vitest';

import { formatDuration, formatPercent, formatScore, plural, share } from './format';

describe('formatting', () => {
  it('formats shares as whole percentages without floating-point noise', () => {
    expect(formatPercent(0.75)).toBe('75%');
    expect(formatPercent(0.14285714285714285)).toBe('14%');
    expect(formatPercent(0.62)).toBe('62%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(1)).toBe('100%');
    // Rare but non-zero, or nearly but not quite all, is not rounded away.
    expect(formatPercent(0.003)).toBe('<1%');
    expect(formatPercent(0.997)).toBe('>99%');
  });

  it('formats durations in seconds, then minutes', () => {
    expect(formatDuration(12122)).toBe('12.1 s');
    expect(formatDuration(0)).toBe('0.0 s');
    expect(formatDuration(59960)).toBe('1 min 0 s');
    expect(formatDuration(75000)).toBe('1 min 15 s');
  });

  it('renders missing values as a dash', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatDuration(null)).toBe('—');
    expect(formatScore(null)).toBe('—');
    expect(share(3, 0)).toBeNull();
  });

  it('rounds scores and pluralizes counts', () => {
    expect(formatScore(92.12765957446808)).toBe('92');
    expect(plural(1, 'play')).toBe('1 play');
    expect(plural(1250, 'play')).toBe('1,250 plays');
  });
});
