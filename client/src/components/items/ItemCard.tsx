import {
  CheckSquare, StickyNote, Link as LinkIcon, FolderKanban,
  Trash2, Calendar, ExternalLink, Check
} from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '../ui/Badge';
import { PRIORITIES, EFFORTS, ENERGIES } from '../../lib/constants';
import { useItemChildren } from '../../hooks/useItems';
import type { Item } from '../../types';
import type { DraggableProvided } from '@hello-pangea/dnd';

const TYPE_ICONS = {
  task: CheckSquare,
  note: StickyNote,
  link: LinkIcon,
  project: FolderKanban,
} as const;

const TYPE_COLORS = {
  task: 'text-blue-400',
  note: 'text-amber-400',
  link: 'text-emerald-400',
  project: 'text-purple-400',
} as const;

interface ItemCardProps {
  item: Item;
  provided: DraggableProvided;
  onClick: () => void;
  onDelete: () => void;
  spaceColor?: string;
  showSpace?: boolean;
}

function formatDueDate(dateStr: string): { text: string; isOverdue: boolean; isToday: boolean } {
  const due = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, isOverdue: true, isToday: false };
  if (diff === 0) return { text: 'Today', isOverdue: false, isToday: true };
  if (diff === 1) return { text: 'Tomorrow', isOverdue: false, isToday: false };
  if (diff <= 7) return { text: `${diff}d`, isOverdue: false, isToday: false };
  return { text: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isOverdue: false, isToday: false };
}

function SubTaskProgress({ parentId }: { parentId: string }) {
  const { data: children = [] } = useItemChildren(parentId);
  if (children.length === 0) return null;

  const done = children.filter((c) => c.horizon === 'done').length;
  const pct = Math.round((done / children.length) * 100);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
        <span>{done}/{children.length} tasks</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LinkDomain({ url }: { url: string }) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return (
      <div className="flex items-center gap-1 mt-1">
        <img
          src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`}
          alt=""
          className="w-3.5 h-3.5 rounded-sm"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span className="text-xs text-emerald-400 truncate">{hostname}</span>
        <ExternalLink size={10} className="text-slate-400 flex-shrink-0" />
      </div>
    );
  } catch {
    return null;
  }
}

export function ItemCard({ item, provided, onClick, onDelete, spaceColor, showSpace }: ItemCardProps) {
  const TypeIcon = TYPE_ICONS[item.type];
  const typeColor = TYPE_COLORS[item.type];
  const priority = PRIORITIES.find((p) => p.value === item.priority);
  const effort = item.effort ? EFFORTS.find((e) => e.value === item.effort) : null;
  const energyConfig = item.energy ? ENERGIES.find((e) => e.value === item.energy) : null;
  const dueInfo = item.due_date ? formatDueDate(item.due_date) : null;
  const isDone = item.horizon === 'done';

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={onClick}
      className={clsx(
        'group bg-white dark:bg-slate-800 rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-all duration-150',
        isDone
          ? 'border-slate-100 dark:border-slate-800 opacity-70'
          : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm',
        item.type === 'note' && 'border-l-2 border-l-amber-400',
        item.type === 'link' && 'border-l-2 border-l-emerald-400',
        item.type === 'project' && 'border-l-2 border-l-purple-400',
      )}
    >
      <div className="flex items-start gap-2">
        {/* Type icon / checkbox for tasks */}
        {item.type === 'task' ? (
          <div
            className={clsx(
              'mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors',
              isDone
                ? 'bg-emerald-500 border-emerald-500'
                : 'border-slate-300 dark:border-slate-600'
            )}
          >
            {isDone && <Check size={10} className="text-white" />}
          </div>
        ) : (
          <TypeIcon size={14} className={clsx('mt-0.5 flex-shrink-0', typeColor)} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={clsx(
              'text-sm font-medium leading-snug',
              isDone && 'line-through text-slate-400 dark:text-slate-500'
            )}>
              {item.title}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all flex-shrink-0"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Note: show description preview */}
          {item.type === 'note' && item.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Link: show domain with favicon */}
          {item.type === 'link' && item.url && <LinkDomain url={item.url} />}

          {/* Project: show sub-task progress */}
          {item.type === 'project' && <SubTaskProgress parentId={item.id} />}

          {/* Badges row */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {showSpace && spaceColor && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: spaceColor }} />
            )}
            {item.type !== 'task' && (
              <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                {item.type}
              </Badge>
            )}
            {priority && priority.value > 0 && (
              <Badge className={priority.color}>{priority.label}</Badge>
            )}
            {effort && (
              <Badge className={effort.color}>{effort.label}</Badge>
            )}
            {energyConfig && (
              <Badge className={energyConfig.color}>{energyConfig.label}</Badge>
            )}
            {dueInfo && (
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 text-[10px] font-medium',
                  dueInfo.isOverdue ? 'text-red-400' : dueInfo.isToday ? 'text-amber-400' : 'text-slate-400'
                )}
              >
                <Calendar size={10} />
                {dueInfo.text}
              </span>
            )}
            {item.tags && item.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-block px-1.5 py-0 rounded-full text-[9px] font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
