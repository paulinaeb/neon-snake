import type { LevelMetrics } from '../api/analytics';
import { formatPercent, plural } from '../format';
import { describeLevelDifficulty, SMALL_SAMPLE } from '../insights';
import { levelCounts, OUTCOMES } from '../outcomes';
import { OutcomeBar } from './OutcomeBar';

// Completion rate per level is the difficulty signal; the rest of each bar shows whether the
// unfinished runs crashed (difficulty) or were abandoned (disengagement).
export const LevelDifficulty = ({ levels }: { levels: LevelMetrics[] }) => {
  const insight = describeLevelDifficulty(levels);
  return (
    <section className="section" aria-labelledby="levels-title">
      <header className="section__head">
        <p className="label">Levels</p>
        <h2 id="levels-title">Which levels are hardest?</h2>
        <p className="section__note">
          Completion rate per level, with how the other plays ended. Every bar starts at the same edge, so the
          completed share compares directly between levels.
        </p>
        {insight && (
          <p className="insight" data-testid="level-insight">
            {insight}
          </p>
        )}
      </header>

      <div className="ladder">
        <div className="ladder__legend" aria-hidden="true">
          {OUTCOMES.map(({ key, label }) => (
            <span key={key}>
              <span className="swatch" data-outcome={key} />
              {label}
            </span>
          ))}
        </div>
        <ol className="ladder__rows">
          {levels.map((level) => (
            <li key={level.level} className="ladder__row" data-testid={`level-row-${level.level}`}>
              <div className="ladder__level">
                <strong>Level {level.level}</strong>
                <span>
                  {plural(level.plays, 'play')}
                  {level.plays < SMALL_SAMPLE && <em> · small sample</em>}
                </span>
              </div>
              <div className="ladder__rate">
                <strong>{formatPercent(level.completionRate)}</strong>
                <span>completed</span>
              </div>
              <OutcomeBar counts={levelCounts(level)} size="compact" labelled={['fail', 'quit']} label={`Level ${level.level} outcomes`} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
