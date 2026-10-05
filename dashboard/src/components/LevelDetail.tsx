import type { LevelMetrics } from '../api/analytics';
import { formatCount, formatDuration, formatPercent, formatScore } from '../format';

// How far players get when they do not finish, plus play length and score per level. Doubles as the
// table view of the level chart (exact counts per outcome).
export const LevelDetail = ({ levels }: { levels: LevelMetrics[] }) => (
  <section className="section" aria-labelledby="detail-title">
    <header className="section__head">
      <p className="label">Unfinished runs</p>
      <h2 id="detail-title">How far do players get when they don't finish?</h2>
      <p className="section__note">
        Average share of the fruit target reached by failed and quit plays, like the fruit bar in the game. Completed
        plays always reach 100%, so they are left out.
      </p>
    </header>

    <div className="section__body">
      <div className="table-scroll">
        <table className="detail-table">
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col" className="progress-col">
                Unfinished runs reach
              </th>
              <th scope="col" className="num">
                Avg. length
              </th>
              <th scope="col" className="num">
                Avg. score<sup>*</sup>
              </th>
              <th scope="col" className="num">
                Plays
              </th>
              <th scope="col" className="num">
                Completed
              </th>
              <th scope="col" className="num">
                Failed
              </th>
              <th scope="col" className="num">
                Quit
              </th>
            </tr>
          </thead>
          <tbody>
            {levels.map((level) => (
              <tr key={level.level} data-testid={`detail-row-${level.level}`}>
                <th scope="row">Level {level.level}</th>
                <td className="progress-col">
                  {level.averageUnfinishedProgress === null ? (
                    <span className="muted">— every play completed</span>
                  ) : (
                    <span className="fruit-meter">
                      <span className="fruit-meter__track" aria-hidden="true">
                        <span
                          className="fruit-meter__fill"
                          style={{ transform: `scaleX(${Math.min(1, Math.max(0, level.averageUnfinishedProgress))})` }}
                        />
                      </span>
                      <span className="fruit-meter__value">{formatPercent(level.averageUnfinishedProgress)}</span>
                    </span>
                  )}
                </td>
                <td className="num">{formatDuration(level.averageDurationMs)}</td>
                <td className="num">{formatScore(level.averageScore)}</td>
                <td className="num">{formatCount(level.plays)}</td>
                <td className="num">{formatCount(level.completed)}</td>
                <td className="num">{formatCount(level.failed)}</td>
                <td className="num">{formatCount(level.quit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        <sup>*</sup> Score carries over from level to level within a game, so later levels start higher. Compare scores
        within a level, not across levels. Length is wall-clock time from start to end of a play, pauses included.
      </p>
    </div>
  </section>
);
