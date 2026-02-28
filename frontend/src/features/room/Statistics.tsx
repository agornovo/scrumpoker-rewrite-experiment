import type { Stats } from '../../types';

interface StatisticsProps {
  stats: Stats | null;
}

export function Statistics({ stats }: StatisticsProps) {
  if (!stats) return null;

  return (
    <div className="statistics" role="region" aria-label="Voting statistics">
      <h3>Statistics</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-label">Average</div>
          <div className="stat-value">{stats.average.toFixed(1)}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Median</div>
          <div className="stat-value">{stats.median}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Min</div>
          <div className="stat-value">{stats.min}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Max</div>
          <div className="stat-value">{stats.max}</div>
        </div>
      </div>
    </div>
  );
}
