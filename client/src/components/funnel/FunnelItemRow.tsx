import { clsx } from 'clsx';
import { Brain, Sun, RotateCw } from 'lucide-react';
import { ENERGIES } from '../../lib/constants';
import type { Item, Space, FocusArea } from '../../types';

const ENERGY_ICONS: Record<string, React.ReactNode> = {
  deep_focus: <Brain size={12} />,
  light: <Sun size={12} />,
  routine: <RotateCw size={12} />,
};

interface FunnelItemRowProps {
  item: Item;
  compact: boolean;
  spaces: Space[];
  focusAreas: FocusArea[];
  showSpaceLabel: boolean;
  isDragging: boolean;
  provided: any;
  onClick: () => void;
}

export function FunnelItemRow({
  item, compact, spaces, focusAreas, showSpaceLabel, isDragging, provided, onClick,
}: FunnelItemRowProps) {
  const space = spaces.find((s) => s.id === item.space_id);
  const fa = focusAreas.find((f) => f.id === item.focus_area_id);
  const energy = item.energy ? ENERGIES.find((e) => e.value === item.energy) : null;

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={onClick}
      className={clsx(
        'bg-white dark:bg-slate-800 rounded-lg px-3 py-2 mb-1 last:mb-0 cursor-grab active:cursor-grabbing transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-blue-400/30'
      )}
    >
      <div className="flex items-start gap-2">
        <p className={clsx('font-medium leading-snug flex-1', compact ? 'text-xs' : 'text-sm')}>
          {item.title}
        </p>
        {item.priority > 0 && (
          <span className={clsx(
            'text-[10px] font-bold flex-shrink-0',
            item.priority === 1 ? 'text-red-400' : item.priority === 2 ? 'text-orange-400' : 'text-slate-400'
          )}>
            P{item.priority}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {showSpaceLabel && space && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: space.color }} />
            {space.name}
            {fa && <> / {fa.name}</>}
          </span>
        )}
        {energy && (
          <span className={clsx('flex items-center gap-0.5 text-[10px] font-medium', energy.color)}>
            {ENERGY_ICONS[item.energy!]}
            {!compact && energy.label}
          </span>
        )}
        {!compact && item.effort && (
          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1 rounded">{item.effort}</span>
        )}
        {!compact && item.due_date && (
          <span className="text-[10px] text-slate-400">{item.due_date}</span>
        )}
      </div>
    </div>
  );
}
