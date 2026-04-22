import { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { FunnelColumn } from './FunnelColumn';
import type { LucideIcon } from 'lucide-react';
import type { Item, Horizon, Space, FocusArea } from '../../types';

interface TierConfig {
  id: Horizon;
  label: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
}

interface SelectedColumn {
  focusAreaId: string;
  label: string;
  color?: string;
}

interface FunnelTierProps {
  tier: TierConfig;
  columns: SelectedColumn[];
  itemsByColumn: Map<string, Item[]>;
  totalItems: number;
  limit: number | undefined;
  spaces: Space[];
  focusAreas: FocusArea[];
  onEditItem: (item: Item) => void;
}

type TierState = 'healthy' | 'warning' | 'overloaded';

function getTierState(total: number, limit: number | undefined): TierState {
  if (!limit) return 'healthy';
  if (total > limit) return 'overloaded';
  if (total >= Math.ceil(limit * 0.7)) return 'warning';
  return 'healthy';
}

function CapacityPopover({ total, limit, state, color }: {
  total: number;
  limit: number;
  state: TierState;
  color: string;
}) {
  const remaining = limit - total;
  const segments = Math.min(limit, 20);
  const filledSegments = Math.min(total, segments);
  const overCount = Math.max(total - limit, 0);

  const segColor = state === 'overloaded' ? '#ef4444' : state === 'warning' ? '#f59e0b' : color;

  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl px-4 py-3 min-w-[180px]">
        {/* Arrow */}
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-slate-800 border-l border-t border-slate-200 dark:border-slate-700" />

        {/* Segmented bar */}
        <div className="flex gap-[3px] mb-2.5">
          {Array.from({ length: segments }, (_, i) => (
            <div
              key={i}
              className={clsx(
                'flex-1 h-3 rounded-sm transition-all duration-300',
                i < filledSegments ? '' : 'bg-slate-100 dark:bg-slate-700',
              )}
              style={i < filledSegments ? { backgroundColor: segColor } : undefined}
            />
          ))}
        </div>

        {/* Status text */}
        <div className="text-center">
          {state === 'overloaded' ? (
            <p className="text-xs font-semibold text-red-500">
              {overCount} over limit
            </p>
          ) : state === 'warning' ? (
            <p className="text-xs font-semibold text-amber-500">
              {remaining} remaining
            </p>
          ) : (
            <p className="text-xs font-medium text-slate-500">
              {remaining} remaining
            </p>
          )}
        </div>

        {/* Overflow segments */}
        {overCount > 0 && (
          <div className="flex gap-[3px] mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
            {Array.from({ length: Math.min(overCount, 10) }, (_, i) => (
              <div
                key={i}
                className="flex-1 h-2 rounded-sm bg-red-400 dark:bg-red-500 animate-pulse"
              />
            ))}
            {overCount > 10 && (
              <span className="text-[9px] font-bold text-red-500 self-center ml-0.5">+{overCount - 10}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function FunnelTier({
  tier, columns, itemsByColumn, totalItems, limit, spaces, focusAreas, onEditItem,
}: FunnelTierProps) {
  const Icon = tier.Icon;
  const isNow = tier.id === 'now';
  const state = getTierState(totalItems, limit);
  const fillPercent = limit ? Math.min((totalItems / limit) * 100, 100) : 0;
  const accentColor = state === 'overloaded' ? '#ef4444' : state === 'warning' ? '#f59e0b' : tier.color;

  const [showPopover, setShowPopover] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = () => {
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setShowPopover(true), 200);
  };
  const handleMouseLeave = () => {
    clearTimeout(hoverTimeout.current);
    setShowPopover(false);
  };

  return (
    <div
      className={clsx(
        'rounded-xl border transition-all overflow-hidden',
        state === 'overloaded'
          ? 'border-red-400/60 dark:border-red-700/60 shadow-[0_0_20px_rgba(239,68,68,0.15)] dark:shadow-[0_0_20px_rgba(239,68,68,0.1)]'
          : state === 'warning'
            ? 'border-amber-300/60 dark:border-amber-700/50 shadow-[0_0_12px_rgba(245,158,11,0.08)]'
            : 'border-slate-200 dark:border-slate-700/50',
        isNow && state === 'healthy' && 'border-blue-200 dark:border-blue-800/50',
      )}
    >
      {/* Header with capacity fill */}
      <div className="relative px-3 py-2.5 bg-slate-50/50 dark:bg-slate-800/40">
        {/* Background capacity fill */}
        {limit && (
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500 ease-out"
            style={{
              width: `${fillPercent}%`,
              background: state === 'overloaded'
                ? 'linear-gradient(90deg, rgba(239,68,68,0.1), rgba(239,68,68,0.2))'
                : state === 'warning'
                  ? 'linear-gradient(90deg, rgba(245,158,11,0.06), rgba(245,158,11,0.14))'
                  : `linear-gradient(90deg, ${tier.color}06, ${tier.color}10)`,
            }}
          />
        )}

        <div className="relative flex items-center gap-2">
          <Icon size={15} style={{ color: accentColor }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>
            {tier.label}
          </span>

          {/* Count badge — hover to reveal capacity popover */}
          <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <span className={clsx(
              'text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full cursor-default transition-all',
              state === 'overloaded' && 'bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse',
              state === 'warning' && 'bg-amber-400 dark:bg-amber-500 text-white shadow-[0_0_6px_rgba(245,158,11,0.3)]',
              state === 'healthy' && 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700',
            )}>
              {totalItems}{limit ? ` of ${limit}` : ''}
            </span>

            {showPopover && limit && (
              <CapacityPopover total={totalItems} limit={limit} state={state} color={tier.color} />
            )}
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className={clsx('p-3', tier.bg)}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {columns.map((col) => (
            <FunnelColumn
              key={col.focusAreaId}
              horizon={tier.id}
              focusAreaId={col.focusAreaId}
              label={col.label}
              color={col.color}
              items={itemsByColumn.get(col.focusAreaId) || []}
              compact={tier.id === 'backlog'}
              spaces={spaces}
              focusAreas={focusAreas}
              onEditItem={onEditItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
