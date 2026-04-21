import { CheckCircle2, TrendingUp, ArrowRightLeft, RefreshCw, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useCurrentReview, useGenerateReview } from '../../hooks/useReviews';

export function WeeklyReviewCard() {
  const { data: review, isLoading } = useCurrentReview();
  const generateReview = useGenerateReview();

  if (isLoading || !review) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <div className="h-32 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>
    );
  }

  const { metrics } = review;
  const weekLabel = `${formatDate(review.period_start)} — ${formatDate(review.period_end)}`;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-400" />
          Weekly Review
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{weekLabel}</span>
          <button
            onClick={() => generateReview.mutate({})}
            disabled={generateReview.isPending}
            className="p-1 rounded-md text-slate-400 hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="Refresh"
          >
            {generateReview.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MetricBox
          icon={<CheckCircle2 size={14} />}
          label="Completed"
          value={metrics.completed}
          color="text-emerald-400"
        />
        <MetricBox
          icon={<TrendingUp size={14} />}
          label="Active"
          value={metrics.activeItems}
          color="text-blue-400"
        />
        <MetricBox
          icon={<ArrowRightLeft size={14} />}
          label="Rolled Over"
          value={metrics.rolledOver}
          color={metrics.rolledOver > 0 ? 'text-amber-400' : 'text-slate-400'}
        />
      </div>

      {/* Daily velocity sparkline */}
      {metrics.dailyVelocity.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Daily Completions</p>
          <div className="flex items-end gap-1 h-8">
            {getDaysOfWeek(review.period_start).map((day) => {
              const match = metrics.dailyVelocity.find((v) => v.day === day);
              const count = match?.count ?? 0;
              const maxCount = Math.max(...metrics.dailyVelocity.map((v) => v.count), 1);
              const heightPct = count > 0 ? Math.max((count / maxCount) * 100, 15) : 5;

              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={clsx('w-full rounded-sm transition-all', count > 0 ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700')}
                    style={{ height: `${heightPct}%` }}
                    title={`${day}: ${count}`}
                  />
                  <span className="text-[8px] text-slate-400">{day.slice(-2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed by type */}
      {metrics.completedByType.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">By Type</p>
          <div className="flex gap-3">
            {metrics.completedByType.map((t: any) => (
              <span key={t.type} className="text-xs text-slate-500">
                <span className="font-medium">{t.count}</span> {t.type}s
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
      <div className={clsx('flex justify-center mb-1', color)}>{icon}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDaysOfWeek(startDate: string): string[] {
  const days: string[] = [];
  const d = new Date(startDate + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}
