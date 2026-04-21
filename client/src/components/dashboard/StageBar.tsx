import { HORIZONS } from '../../lib/constants';

interface HorizonBarProps {
  horizonDistribution: { horizon: string; count: number }[];
  total: number;
}

export function StageBar({ horizonDistribution, total }: HorizonBarProps) {
  if (total === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-4">
        No items yet. Use Cmd+K to capture something.
      </p>
    );
  }

  return (
    <div>
      <div className="flex h-6 rounded-lg overflow-hidden gap-0.5">
        {HORIZONS.map((h) => {
          const match = horizonDistribution.find((d) => d.horizon === h.id);
          const count = match?.count ?? 0;
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={h.id}
              className="transition-all duration-500 rounded-sm"
              style={{
                width: `${pct}%`,
                backgroundColor: h.accentColor,
                minWidth: count > 0 ? '4px' : 0,
              }}
              title={`${h.label}: ${count}`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {HORIZONS.map((h) => {
          const match = horizonDistribution.find((d) => d.horizon === h.id);
          const count = match?.count ?? 0;
          return (
            <div key={h.id} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: h.accentColor }}
              />
              <span className="text-slate-500 dark:text-slate-400">{h.label}</span>
              <span className="font-medium">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
