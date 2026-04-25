import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, Clock, CheckCircle2, TrendingUp,
  Target, BarChart3, Calendar, Zap, Weight, ArrowLeftRight, Timer
} from 'lucide-react';
import { clsx } from 'clsx';
import { getStats } from '../../lib/api';
import { useSpaces } from '../../hooks/useSpaces';
import { VelocityChart } from './VelocityChart';
import { StageBar } from './StageBar';
import { FunnelChart } from './FunnelChart';
import { AiAdvisor } from './AiAdvisor';
import { WeeklyReviewCard } from './WeeklyReviewCard';
import { EnergyChart } from './EnergyChart';
import { PriorityChart } from './PriorityChart';
import { EffortChart } from './EffortChart';
import { FlowChart } from './FlowChart';
import { AgeChart } from './AgeChart';
import { FunnelIcon } from '../ui/FunnelIcon';
import { ItemModal } from '../items/ItemModal';
import type { Item } from '../../types';

const TIMEFRAME_OPTIONS = [
  { value: 3, label: '3d' },
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
] as const;

export function Dashboard() {
  const [spaceFilter, setSpaceFilter] = useState('');
  const [chartDays, setChartDays] = useState(7);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const { data: spaces = [] } = useSpaces();

  const overdueRef = useRef<HTMLDivElement>(null);
  const dueSoonRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef<HTMLDivElement>(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', spaceFilter, chartDays],
    queryFn: () => getStats(spaceFilter || undefined, chartDays),
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

  const {
    horizonDistribution, bySpace, byEnergy, byPriority, byEffort, byFocusArea,
    overdue, dueSoon, recentlyCompleted, velocity, createdPerDay, avgAge,
    staleBacklog, needsAttention, totals,
  } = stats;

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Space filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSpaceFilter('')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              !spaceFilter
                ? 'bg-blue-500/10 text-blue-500'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            All Spaces
          </button>
          {spaces.map((s) => (
            <button
              key={s.id}
              onClick={() => setSpaceFilter(spaceFilter === s.id ? '' : s.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                spaceFilter === s.id
                  ? 'text-white'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
              style={spaceFilter === s.id ? { backgroundColor: s.color } : undefined}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={spaceFilter !== s.id ? { backgroundColor: s.color } : { backgroundColor: 'rgba(255,255,255,0.5)' }}
              />
              {s.name}
            </button>
          ))}
        </div>

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
            onClick={recentlyCompleted.length > 0 ? () => scrollTo(completedRef) : undefined}
          />
          <SummaryCard
            icon={<AlertTriangle size={18} />}
            label="Overdue"
            value={overdue.length}
            color={overdue.length > 0 ? 'text-red-400' : 'text-slate-400'}
            bgColor={overdue.length > 0 ? 'bg-red-500/10' : 'bg-slate-500/10'}
            onClick={overdue.length > 0 ? () => scrollTo(overdueRef) : undefined}
          />
          <SummaryCard
            icon={<Clock size={18} />}
            label="Due This Week"
            value={dueSoon.length}
            color={dueSoon.length > 0 ? 'text-amber-400' : 'text-slate-400'}
            bgColor={dueSoon.length > 0 ? 'bg-amber-500/10' : 'bg-slate-500/10'}
            onClick={dueSoon.length > 0 ? () => scrollTo(dueSoonRef) : undefined}
          />
        </div>

        {/* Funnel + Stage bar */}
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

        {/* Created vs Completed Flow + Age Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-blue-400" />
              Created vs Completed
              <div className="ml-auto flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setChartDays(opt.value)}
                    className={clsx(
                      'px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors',
                      chartDays === opt.value
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-400'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </h3>
            <FlowChart velocity={velocity} createdPerDay={createdPerDay || []} numDays={chartDays} />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Timer size={16} className="text-amber-400" />
              Average Age by Horizon
            </h3>
            <AgeChart avgAge={avgAge || []} />
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

        {/* Priority + Effort */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              Priority Distribution
            </h3>
            <PriorityChart byPriority={byPriority || []} />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Weight size={16} className="text-orange-400" />
              Effort Breakdown
            </h3>
            <EffortChart byEffort={byEffort || []} />
          </div>
        </div>

        {/* Velocity + Space breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              Completion Velocity
              <span className="text-xs font-normal text-slate-400 ml-auto">Last {chartDays}d</span>
            </h3>
            <VelocityChart velocity={velocity} numDays={chartDays} />
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

        {/* Focus Area breakdown */}
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
          <div ref={overdueRef} className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/50 p-5">
            <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} />
              Overdue ({overdue.length})
            </h3>
            <ItemList items={overdue} onItemClick={setEditingItem} />
          </div>
        )}

        {/* Due soon */}
        {dueSoon.length > 0 && (
          <div ref={dueSoonRef} className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/50 p-5">
            <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
              <Calendar size={16} />
              Due This Week ({dueSoon.length})
            </h3>
            <ItemList items={dueSoon} onItemClick={setEditingItem} />
          </div>
        )}

        {/* Recently completed */}
        {recentlyCompleted.length > 0 && (
          <div ref={completedRef} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} />
              Recently Completed ({recentlyCompleted.length})
            </h3>
            <ItemList items={recentlyCompleted} showCompleted onItemClick={setEditingItem} />
          </div>
        )}
      </div>

      <ItemModal
        isOpen={editingItem !== null}
        item={editingItem}
        defaultHorizon={null}
        onClose={() => setEditingItem(null)}
      />
    </div>
  );
}

function SummaryCard({
  icon, label, value, color, bgColor, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4',
        onClick && 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors'
      )}
      onClick={onClick}
    >
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

function ItemList({ items, showCompleted, onItemClick }: { items: any[]; showCompleted?: boolean; onItemClick: (item: any) => void }) {
  const priorityLabels = ['', 'P1', 'P2', 'P3', 'P4'];
  const priorityColors = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-slate-400'];

  return (
    <div className="space-y-2">
      {items.map((item: any) => (
        <div
          key={item.id}
          onClick={() => onItemClick(item)}
          className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
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
