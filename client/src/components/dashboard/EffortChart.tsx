import { EFFORTS } from '../../lib/constants';

interface EffortChartProps {
  byEffort: { effort: string; count: number }[];
}

const EFFORT_COLORS: Record<string, string> = {
  S: '#22c55e',
  M: '#3b82f6',
  L: '#f97316',
  XL: '#ef4444',
};

export function EffortChart({ byEffort }: EffortChartProps) {
  const total = byEffort.reduce((sum, e) => sum + e.count, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-6">
        No effort estimates yet.
      </p>
    );
  }

  return (
    <div>
      {/* Stacked horizontal bar */}
      <div className="h-8 rounded-lg overflow-hidden flex">
        {EFFORTS.map((config) => {
          const match = byEffort.find((e) => e.effort === config.value);
          const count = match?.count ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;

          return (
            <div
              key={config.value}
              className="h-full flex items-center justify-center transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: EFFORT_COLORS[config.value] + '40' }}
            >
              {pct > 10 && (
                <span className="text-[10px] font-bold" style={{ color: EFFORT_COLORS[config.value] }}>
                  {config.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-center">
        {EFFORTS.map((config) => {
          const match = byEffort.find((e) => e.effort === config.value);
          const count = match?.count ?? 0;
          return (
            <div key={config.value} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: EFFORT_COLORS[config.value] }}
              />
              <span className="text-xs text-slate-500">
                {config.label}: <span className="font-medium">{count}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
