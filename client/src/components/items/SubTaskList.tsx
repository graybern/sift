import { useState } from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { useItemChildren, useCreateItem, useUpdateItem, useDeleteItem } from '../../hooks/useItems';
import type { Item } from '../../types';

interface SubTaskListProps {
  parentId: string;
  spaceId: string | null;
}

export function SubTaskList({ parentId, spaceId }: SubTaskListProps) {
  const { data: children = [], isLoading } = useItemChildren(parentId);
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const [newTitle, setNewTitle] = useState('');

  const done = children.filter((c) => c.horizon === 'done').length;
  const pct = children.length > 0 ? Math.round((done / children.length) * 100) : 0;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    createItem.mutate(
      { title: newTitle.trim(), type: 'task', parent_id: parentId, space_id: spaceId, horizon: 'later' },
      {
        onSuccess: () => setNewTitle(''),
        onError: () => toast.error('Failed to add sub-task'),
      }
    );
  };

  const toggleDone = (child: Item) => {
    const newHorizon = child.horizon === 'done' ? 'later' : 'done';
    updateItem.mutate({ id: child.id, horizon: newHorizon });
  };

  if (isLoading) {
    return <div className="text-xs text-slate-400 py-2">Loading sub-tasks...</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Sub-tasks
        </h4>
        {children.length > 0 && (
          <span className="text-[10px] text-slate-400">
            {done}/{children.length} done ({pct}%)
          </span>
        )}
      </div>

      {/* Progress bar */}
      {children.length > 0 && (
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Sub-task list */}
      <div className="space-y-1">
        {children.map((child) => (
          <div
            key={child.id}
            className="flex items-center gap-2 group py-1 px-1 -mx-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <button
              onClick={() => toggleDone(child)}
              className={clsx(
                'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                child.horizon === 'done'
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
              )}
            >
              {child.horizon === 'done' && <Check size={10} className="text-white" />}
            </button>
            <span
              className={clsx(
                'flex-1 text-sm',
                child.horizon === 'done' && 'line-through text-slate-400'
              )}
            >
              {child.title}
            </span>
            <button
              onClick={() => deleteItem.mutate(child.id)}
              className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new sub-task */}
      <div className="flex items-center gap-2">
        <Plus size={14} className="text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="Add a sub-task..."
          className="flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
        />
      </div>
    </div>
  );
}
