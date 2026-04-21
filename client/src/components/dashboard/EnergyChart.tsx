import { Brain, Sun, RotateCw } from 'lucide-react';
import { clsx } from 'clsx';
import { ENERGIES } from '../../lib/constants';

interface EnergyChartProps {
  byEnergy: { energy: string; count: number }[];
}

const ENERGY_ICONS: Record<string, React.ReactNode> = {
  deep_focus: <Brain size={16} />,
  light: <Sun size={16} />,
  routine: <RotateCw size={16} />,
};

export function EnergyChart({ byEnergy }: EnergyChartProps) {
  const total = byEnergy.reduce((sum, e) => sum + e.count, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-6">
        No energy tags assigned yet. Add energy levels to items to see distribution.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {ENERGIES.map((config) => {
        const match = byEnergy.find((e) => e.energy === config.value);
        const count = match?.count ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;

        return (
          <div key={config.value} className="flex items-center gap-3">
            <div className={clsx('p-1.5 rounded-lg', config.color)}>
              {ENERGY_ICONS[config.value]}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{config.label}</span>
                <span className="text-xs text-slate-400">{count} ({pct}%)</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: config.value === 'deep_focus' ? '#ef4444' : config.value === 'light' ? '#eab308' : '#22c55e',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
