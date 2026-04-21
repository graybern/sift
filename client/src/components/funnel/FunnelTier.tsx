import { clsx } from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { FunnelColumn } from './FunnelColumn';
import { FUNNEL_TIER_LIMITS } from '../../lib/constants';
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
  spaces: Space[];
  focusAreas: FocusArea[];
  onEditItem: (item: Item) => void;
}

export function FunnelTier({
  tier, columns, itemsByColumn, totalItems, spaces, focusAreas, onEditItem,
}: FunnelTierProps) {
  const Icon = tier.Icon;
  const isBacklog = tier.id === 'backlog';
  const isNow = tier.id === 'now';
  const limit = FUNNEL_TIER_LIMITS[tier.id];
  const overLimit = limit && totalItems > limit;

  return (
    <div
      className={clsx(
        'rounded-xl border transition-all p-3',
        tier.bg,
        'border-slate-200 dark:border-slate-700/50',
        isNow && 'border-blue-200 dark:border-blue-800/50',
      )}
      style={{ borderLeftWidth: '3px', borderLeftColor: tier.color }}
    >
      {/* Tier header */}
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} style={{ color: tier.color }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tier.color }}>
          {tier.label}
        </span>
        <span className="text-[10px] text-slate-400 tabular-nums">{totalItems}</span>

        {overLimit && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500">
            <AlertTriangle size={11} />
            {totalItems}/{limit} items
          </span>
        )}
      </div>

      {/* Columns */}
      <div className="flex gap-2">
        {columns.map((col) => (
          <FunnelColumn
            key={col.focusAreaId}
            horizon={tier.id}
            focusAreaId={col.focusAreaId}
            label={col.label}
            color={col.color}
            items={itemsByColumn.get(col.focusAreaId) || []}
            compact={isBacklog}
            spaces={spaces}
            focusAreas={focusAreas}
            onEditItem={onEditItem}
          />
        ))}
      </div>
    </div>
  );
}
