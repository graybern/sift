import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, Clock, CheckCircle2, TrendingUp,
  Target, BarChart3, Calendar, Zap
} from 'lucide-react';
import { clsx } from 'clsx';
import { getStats } from '../../lib/api';
import { VelocityChart } from './VelocityChart';
import { StageBar } from './StageBar';
import { FunnelChart } from './FunnelChart';
import { AiAdvisor } from './AiAdvisor';
import { WeeklyReviewCard } from './WeeklyReviewCard';
import { EnergyChart } from './EnergyChart';
import { FunnelIcon } from '../ui/FunnelIcon';

export function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: 30000,
  });

  if (isLoading || !stats) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const { horizonDistribution, bySpace, byEnergy, byFocusArea, overdue, dueSoon, recentlyCompleted, velocity, staleBacklog, needsAttention, totals } = stats;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={<BarChart3 size={18} />}
            label="Active Items"
            value={totals.active}
            color="text-blue-400"
            bgColor="bg-blue-500/10"
          />
          <SummaryCard
            icon={<CheckCircle2 size={18} />}
            label="Completed"
            value={totals.done}
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
          />
          <SummaryCard
            icon={<AlertTriangle size={18} />}
            label="Overdue"
            value={overdue.length}
            color={overdue.length > 0 ? 'text-red-400' : 'text-slate-400'}
            bgColor={overdue.length > 0 ? 'bg-red-500/10' : 'bg-slate-500/10'}
          />
          <SummaryCard
            icon={<Clock size={18} />}
            label="Due This Week"
            value={dueSoon.length}
            color={dueSoon.length > 0 ? 'text-amber-400' : 'text-slate-400'}
            bgColor={dueSoon.length > 0 ? 'bg-amber-500/10' : 'bg-slate-500/10'}
          />
        </div>

        {/* Funnel + Stage bar side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <FunnelIcon size={16} className="text-blue-400" />
              Pipeline Funnel
            </h3>
            <FunnelChart horizonDistribution={horizonDistribution} total={totals.all} />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Target size={16} className="text-blue-400" />
              Horizon Breakdown
            </h3>
            <StageBar horizonDistribution={horizonDistribution} total={totals.all} />
          </div>
        </div>

        {/* Weekly Review + Energy */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WeeklyReviewCard />
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              Energy Distribution
            </h3>
            <EnergyChart byEnergy={byEnergy || []} />
          </div>
        </div>

        {/* Velocity + Space breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              Completion Velocity
              <span className="text-xs font-normal text-slate-400 ml-auto">Last 14 days</span>
            </h3>
            <VelocityChart velocity={velocity} />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <BarChart3 size={16} className="text-purple-400" />
              Items by Space
            </h3>
            <div className="space-y-3">
              {bySpace.map((space: any) => (
                <div key={space.name} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: space.color }} />
                  <span className="text-sm flex-1">{space.name}</span>
                  <span className="text-sm font-medium text-slate-500">{space.count}</span>
                  <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: space.color,
                        width: `${totals.all > 0 ? (space.count / totals.all) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Focus Area breakdown (if any exist) */}
        {byFocusArea && byFocusArea.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Target size={16} className="text-blue-400" />
              Items by Focus Area
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {byFocusArea.map((fa: any) => (
                <div key={fa.name} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fa.space_color }} />
                    <span className="text-[10px] text-slate-400">{fa.space_name}</span>
                  </div>
                  <p className="text-sm font-medium">{fa.name}</p>
                  <p className="text-lg font-bold mt-1">{fa.count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Advisor */}
        <AiAdvisor
          overdue={overdue}
          staleBacklog={staleBacklog}
          needsAttention={needsAttention}
          dueSoon={dueSoon}
        />

        {/* Overdue items */}
        {overdue.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/50 p-5">
            <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} />
              Overdue ({overdue.length})
            </h3>
            <ItemList items={overdue} />
          </div>
        )}

        {/* Due soon */}
        {dueSoon.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/50 p-5">
            <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
              <Calendar size={16} />
              Due This Week ({dueSoon.length})
            </h3>
            <ItemList items={dueSoon} />
          </div>
        )}

        {/* Recently completed */}
        {recentlyCompleted.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} />
              Recently Completed ({recentlyCompleted.length})
            </h3>
            <ItemList items={recentlyCompleted} showCompleted />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon, label, value, color, bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-center gap-3">
        <div className={clsx('p-2 rounded-lg', bgColor, color)}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ItemList({ items, showCompleted }: { items: any[]; showCompleted?: boolean }) {
  const priorityLabels = ['', 'P1', 'P2', 'P3', 'P4'];
  const priorityColors = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-slate-400'];

  return (
    <div className="space-y-2">
      {items.map((item: any) => (
        <div
          key={item.id}
          className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          {item.space_color && (
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.space_color }} />
          )}
          <span className={clsx('text-sm flex-1', showCompleted && 'line-through text-slate-400')}>
            {item.title}
          </span>
          {item.priority > 0 && (
            <span className={clsx('text-[10px] font-bold', priorityColors[item.priority])}>
              {priorityLabels[item.priority]}
            </span>
          )}
          {item.due_date && (
            <span className="text-xs text-slate-400">{item.due_date}</span>
          )}
          {showCompleted && item.completed_at && (
            <span className="text-xs text-slate-400">
              {new Date(item.completed_at).toLocaleDateString()}
            </span>
          )}
          {item.space_name && (
            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {item.space_name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
