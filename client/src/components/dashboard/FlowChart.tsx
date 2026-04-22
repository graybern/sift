interface FlowChartProps {
  velocity: { day: string; count: number }[];
  createdPerDay: { day: string; count: number }[];
}

export function FlowChart({ velocity, createdPerDay }: FlowChartProps) {
  const days: { day: string; created: number; completed: number; label: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split('T')[0]!;
    days.push({
      day: dayStr,
      created: createdPerDay.find((v) => v.day === dayStr)?.count ?? 0,
      completed: velocity.find((v) => v.day === dayStr)?.count ?? 0,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }

  const maxCount = Math.max(...days.map((d) => Math.max(d.created, d.completed)), 1);
  const totalCreated = days.reduce((s, d) => s + d.created, 0);
  const totalCompleted = days.reduce((s, d) => s + d.completed, 0);
  const net = totalCompleted - totalCreated;

  return (
    <div>
      <div className="flex items-end gap-1 h-28">
        {days.map((d) => {
          const createdH = (d.created / maxCount) * 100;
          const completedH = (d.completed / maxCount) * 100;
          return (
            <div key={d.day} className="flex-1 flex items-end gap-[1px] group relative">
              <div
                className="flex-1 bg-blue-400/60 rounded-t transition-all duration-300 min-h-[2px]"
                style={{ height: `${Math.max(createdH, d.created > 0 ? 8 : 2)}%` }}
              />
              <div
                className="flex-1 bg-emerald-500/70 rounded-t transition-all duration-300 min-h-[2px]"
                style={{ height: `${Math.max(completedH, d.completed > 0 ? 8 : 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1 mt-1 px-0.5">
        {days.map((d) => (
          <div key={d.day} className="flex-1 text-center">
            <span className="text-[8px] text-slate-400">{d.label.slice(0, 2)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-400/60" />
            <span className="text-xs text-slate-500">Created: <span className="font-medium">{totalCreated}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" />
            <span className="text-xs text-slate-500">Completed: <span className="font-medium">{totalCompleted}</span></span>
          </div>
        </div>
        <span className={`text-xs font-medium ${net > 0 ? 'text-emerald-500' : net < 0 ? 'text-amber-500' : 'text-slate-400'}`}>
          {net > 0 ? `+${net} net` : net < 0 ? `${net} net` : 'Balanced'}
        </span>
      </div>
    </div>
  );
}
