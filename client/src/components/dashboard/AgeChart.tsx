import { HORIZONS } from '../../lib/constants';

interface AgeChartProps {
  avgAge: { horizon: string; avg_days: number; count: number }[];
}

const HORIZON_ORDER = ['backlog', 'later', 'soon', 'now'];

export function AgeChart({ avgAge }: AgeChartProps) {
  if (avgAge.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No active items yet.</p>;
  }

  const sorted = [...avgAge]
    .filter((a) => HORIZON_ORDER.includes(a.horizon))
    .sort((a, b) => HORIZON_ORDER.indexOf(a.horizon) - HORIZON_ORDER.indexOf(b.horizon));

  const maxDays = Math.max(...sorted.map((a) => a.avg_days), 1);

  return (
    <div className="space-y-3">
      {sorted.map((entry) => {
        const horizon = HORIZONS.find((h) => h.id === entry.horizon);
        if (!horizon) return null;
        const pct = (entry.avg_days / maxDays) * 100;

        return (
          <div key={entry.horizon} className="flex items-center gap-3">
            <span
              className="text-xs font-medium w-14 flex-shrink-0"
              style={{ color: horizon.accentColor }}
            >
              {horizon.label}
            </span>
            <div className="flex-1">
              <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-500 flex items-center px-2"
                  style={{
                    width: `${Math.max(pct, 15)}%`,
                    backgroundColor: horizon.accentColor + '25',
                  }}
                >
                  <span className="text-[10px] font-bold" style={{ color: horizon.accentColor }}>
                    {entry.avg_days}d avg
                  </span>
                </div>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 w-12 text-right flex-shrink-0">
              {entry.count} items
            </span>
          </div>
        );
      })}
    </div>
  );
}
