import { Plus, Archive, CalendarClock, Timer, Zap, CheckCircle2 } from 'lucide-react';
import type { HorizonConfig } from '../../lib/constants';
import type { Item } from '../../types';

const HORIZON_ICONS = {
  Archive,
  CalendarClock,
  Timer,
  Zap,
  CheckCircle2,
} as const;

interface StageHeaderProps {
  stage: HorizonConfig;
  items: Item[];
  onAdd: () => void;
}

export function StageHeader({ stage, items, onAdd }: StageHeaderProps) {
  const Icon = HORIZON_ICONS[stage.icon as keyof typeof HORIZON_ICONS] || Archive;

  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: stage.accentColor }} />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {stage.label}
        </h3>
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
          {items.length}
        </span>
      </div>
      <button
        onClick={onAdd}
        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        title={`Add to ${stage.label}`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
