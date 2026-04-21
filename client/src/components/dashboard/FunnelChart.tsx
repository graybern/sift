import { HORIZONS } from '../../lib/constants';
import { clsx } from 'clsx';

interface FunnelChartProps {
  horizonDistribution: { horizon: string; count: number }[];
  total: number;
}

export function FunnelChart({ horizonDistribution, total }: FunnelChartProps) {
  if (total === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        No items yet. Use Cmd+K to start capturing.
      </p>
    );
  }

  const funnelHorizons = HORIZONS.map((h) => {
    const match = horizonDistribution.find((d) => d.horizon === h.id);
    return {
      ...h,
      count: match?.count ?? 0,
    };
  });

  const maxCount = Math.max(...funnelHorizons.map((h) => h.count), 1);

  return (
    <div className="space-y-1.5">
      {funnelHorizons.map((h, index) => {
        const funnelTaper = 1 - index * 0.15;
        const dataProportion = maxCount > 0 ? h.count / maxCount : 0;
        const widthPct = Math.max(
          (funnelTaper * 0.6 + dataProportion * 0.4) * 100,
          h.count > 0 ? 20 : 12
        );

        return (
          <div key={h.id} className="flex items-center gap-3">
            <div className="w-20 text-right flex-shrink-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {h.label}
              </span>
            </div>

            <div className="flex-1 flex justify-center">
              <div
                className={clsx(
                  'relative h-10 rounded-lg flex items-center justify-center transition-all duration-500',
                  h.count === 0 && 'opacity-30'
                )}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: h.accentColor + '25',
                  borderLeft: `3px solid ${h.accentColor}`,
                  borderRight: `3px solid ${h.accentColor}`,
                }}
              >
                <span
                  className="text-sm font-bold"
                  style={{ color: h.accentColor }}
                >
                  {h.count}
                </span>

                {h.count > 0 && total > 0 && (
                  <span className="absolute right-2 text-[10px] text-slate-400">
                    {Math.round((h.count / total) * 100)}%
                  </span>
                )}
              </div>
            </div>

            <div className="w-10 flex-shrink-0">
              <span className="text-xs text-slate-400">
                {h.count > 0 ? `${h.count}` : '\u2014'}
              </span>
            </div>
          </div>
        );
      })}

      <div className="flex justify-center pt-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 4h18l-6.5 7.5V18l-5 3V11.5L3 4z" />
          </svg>
          <span>
            {total} total items across {funnelHorizons.filter((h) => h.count > 0).length} horizons
          </span>
        </div>
      </div>
    </div>
  );
}
