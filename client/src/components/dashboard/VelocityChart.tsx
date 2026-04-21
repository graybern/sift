interface VelocityChartProps {
  velocity: { day: string; count: number }[];
}

export function VelocityChart({ velocity }: VelocityChartProps) {
  // Build a 14-day array, filling in zeros for days with no completions
  const days: { day: string; count: number; label: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split('T')[0]!;
    const match = velocity.find((v) => v.day === dayStr);
    days.push({
      day: dayStr,
      count: match?.count ?? 0,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }

  const maxCount = Math.max(...days.map((d) => d.count), 1);
  const avgPerDay = velocity.length > 0
    ? (velocity.reduce((sum, v) => sum + v.count, 0) / 14).toFixed(1)
    : '0';

  return (
    <div>
      <div className="flex items-end gap-1.5 h-32">
        {days.map((d) => {
          const heightPct = (d.count / maxCount) * 100;
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-slate-400 font-medium">
                {d.count > 0 ? d.count : ''}
              </span>
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full bg-emerald-500/80 rounded-t transition-all duration-300 min-h-[2px]"
                  style={{ height: `${Math.max(heightPct, d.count > 0 ? 8 : 2)}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-400">{d.label.slice(0, 2)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-slate-400 text-center">
        Average: <span className="font-medium text-emerald-400">{avgPerDay}</span> items/day
      </div>
    </div>
  );
}
