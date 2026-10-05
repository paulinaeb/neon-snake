import { formatCount, formatPercent, plural, share } from '../format';
import type { Outcome } from '../api/analytics';
import { OUTCOMES, type OutcomeCounts } from '../outcomes';

type OutcomeBarProps = {
  counts: OutcomeCounts;
  size?: 'large' | 'compact';
  // Outcomes whose share is printed inside the segment, when it fits (at least 14%). Values shown
  // elsewhere nearby are not repeated; small segments are read from the tooltip and the level table.
  labelled?: Outcome[];
  label: string;
};

const total = (counts: OutcomeCounts) => counts.complete + counts.fail + counts.quit;

export const describeOutcomes = (counts: OutcomeCounts): string =>
  OUTCOMES.map(({ key, label }) => `${label} ${formatCount(counts[key])} (${formatPercent(share(counts[key], total(counts)))})`).join(', ');

// A 100% bar of how plays ended. Segments always appear in the same order, so "completed" starts at
// the left edge and is comparable between bars.
export const OutcomeBar = ({ counts, size = 'large', labelled = [], label }: OutcomeBarProps) => {
  const sum = total(counts);
  return (
    <div className={`outcome-bar outcome-bar--${size}`} role="img" aria-label={`${label}: ${describeOutcomes(counts)}`}>
      {OUTCOMES.filter(({ key }) => counts[key] > 0).map(({ key, label: outcomeLabel }) => {
        const part = share(counts[key], sum)!;
        return (
          <div
            key={key}
            className="outcome-bar__segment"
            data-outcome={key}
            style={{ flexGrow: counts[key] }}
            data-tip={`${outcomeLabel} · ${plural(counts[key], 'play')} · ${formatPercent(part)}`}
          >
            {labelled.includes(key) && part >= 0.14 && <span className="outcome-bar__value">{formatPercent(part)}</span>}
          </div>
        );
      })}
    </div>
  );
};

// Legend with exact counts: the identity channel that does not rely on color.
export const OutcomeLegend = ({ counts }: { counts: OutcomeCounts }) => {
  const sum = total(counts);
  return (
    <ul className="outcome-legend">
      {OUTCOMES.map(({ key, label, description }) => (
        <li key={key} className="outcome-legend__item">
          <span className="swatch" data-outcome={key} aria-hidden="true" />
          <span className="outcome-legend__label">{label}</span>
          <span className="outcome-legend__value">
            <strong>{formatCount(counts[key])}</strong> · {formatPercent(share(counts[key], sum))}
          </span>
          <span className="outcome-legend__description">{description}</span>
        </li>
      ))}
    </ul>
  );
};
