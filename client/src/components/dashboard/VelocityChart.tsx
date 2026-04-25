interface VelocityChartProps {
  velocity: { day: string; count: number }[];
  numDays?: number;
}

export function VelocityChart({ velocity, numDays = 7 }: VelocityChartProps) {
  const days: { day: string; count: number; label: string }[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
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
    ? (velocity.reduce((sum, v) => sum + v.count, 0) / numDays).toFixed(1)
    : '0';

  const labelEvery = numDays <= 14 ? 1 : numDays <= 30 ? 7 : 14;
  const showCounts = numDays <= 14;

  return (
    <div>
      <div className="flex items-end gap-px h-32">
        {days.map((d) => {
          const heightPct = (d.count / maxCount) * 100;
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5">
              {showCounts && (
                <span className="text-[9px] text-slate-400 font-medium">
                  {d.count > 0 ? d.count : ''}
                </span>
              )}
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full bg-emerald-500/80 rounded-t transition-all duration-300 min-h-[2px]"
                  style={{ height: `${Math.max(heightPct, d.count > 0 ? 8 : 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center mt-1 px-0.5">
        {days.map((d, i) => (
          <div key={d.day} className="flex-1 text-center">
            {i % labelEvery === 0 ? (
              <span className="text-[9px] text-slate-400">
                {numDays > 14
                  ? `${new Date(d.day).getMonth() + 1}/${new Date(d.day).getDate()}`
                  : d.label.slice(0, 2)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-slate-400 text-center">
        Average: <span className="font-medium text-emerald-400">{avgPerDay}</span> items/day
      </div>
    </div>
  );
}
