import type { Overview as OverviewData } from '../api/analytics';
import { formatDuration, formatPercent, formatScore, plural } from '../format';
import { overviewCounts } from '../outcomes';
import { OutcomeBar, OutcomeLegend } from './OutcomeBar';

// Completion rate leads: it is the one number that says whether players get through levels. Plays
// and the outcome split explain it; the averages are context and stay quiet.
export const Overview = ({ overview }: { overview: OverviewData }) => (
  <section className="overview" aria-labelledby="overview-title">
    <div className="overview__headline">
      <h2 id="overview-title" className="label">
        Completion rate
      </h2>
      <p className="hero" data-testid="completion-rate">
        {formatPercent(overview.completionRate)}
      </p>
      <p className="lede">
        of <strong data-testid="total-plays">{plural(overview.totalPlays, 'play')}</strong> reached the level's fruit
        target.
      </p>
    </div>

    <div className="overview__outcomes">
      <h3 className="label">How plays ended</h3>
      <OutcomeBar counts={overviewCounts(overview)} label="Outcome of all plays" />
      <OutcomeLegend counts={overviewCounts(overview)} />
    </div>

    <dl className="stat-strip">
      <div>
        <dt>Unfinished runs end at</dt>
        <dd>
          {formatPercent(overview.averageUnfinishedProgress)}{' '}
          <small>{overview.averageUnfinishedProgress === null ? 'no unfinished runs' : 'of the target'}</small>
        </dd>
      </div>
      <div>
        <dt>Average progress</dt>
        <dd>{formatPercent(overview.averageProgress)}</dd>
      </div>
      <div>
        <dt>Average play length</dt>
        <dd>{formatDuration(overview.averageDurationMs)}</dd>
      </div>
      <div>
        <dt>Average score at end</dt>
        <dd>{formatScore(overview.averageScore)}</dd>
      </div>
    </dl>
  </section>
);
