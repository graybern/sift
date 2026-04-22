import { clsx } from 'clsx';
import { PRIORITIES } from '../../lib/constants';

interface PriorityChartProps {
  byPriority: { priority: number; count: number }[];
}

const PRIORITY_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#94a3b8'];

export function PriorityChart({ byPriority }: PriorityChartProps) {
  const total = byPriority.reduce((sum, p) => sum + p.count, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-6">
        No priorities assigned yet.
      </p>
    );
  }

  const maxCount = Math.max(...byPriority.map((p) => p.count), 1);

  return (
    <div className="space-y-3">
      {PRIORITIES.filter((p) => p.value > 0).map((config) => {
        const match = byPriority.find((p) => p.priority === config.value);
        const count = match?.count ?? 0;

        return (
          <div key={config.value} className="flex items-center gap-3">
            <span className={clsx('text-xs font-bold w-7 text-center px-1 py-0.5 rounded', config.color)}>
              {config.label}
            </span>
            <div className="flex-1">
              <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden flex items-center">
                <div
                  className="h-full rounded transition-all duration-500 flex items-center justify-end pr-2"
                  style={{
                    width: `${Math.max((count / maxCount) * 100, count > 0 ? 12 : 0)}%`,
                    backgroundColor: PRIORITY_COLORS[config.value] + '30',
                  }}
                >
                  {count > 0 && (
                    <span className="text-[10px] font-bold" style={{ color: PRIORITY_COLORS[config.value] }}>
                      {count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
