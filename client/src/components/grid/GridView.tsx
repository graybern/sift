import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useItems } from '../../hooks/useItems';
import { useSpaces, useActiveSpace } from '../../hooks/useSpaces';
import { useFocusAreas } from '../../hooks/useFocusAreas';
import { ItemModal } from '../items/ItemModal';
import { HORIZONS, PRIORITIES, EFFORTS, ENERGIES } from '../../lib/constants';
import type { Item } from '../../types';

type SortField = 'title' | 'type' | 'horizon' | 'priority' | 'effort' | 'energy' | 'due_date' | 'created_at';
type SortDir = 'asc' | 'desc';

const HORIZON_ORDER: Record<string, number> = { backlog: 0, later: 1, soon: 2, now: 3, done: 4 };

export function GridView() {
  const { activeSpaceId, activeFocusAreaId } = useActiveSpace();
  const filters = activeFocusAreaId
    ? { focus_area_id: activeFocusAreaId }
    : activeSpaceId
      ? { space_id: activeSpaceId }
      : undefined;
  const { data: items = [], isLoading } = useItems(filters);
  const { data: spaces = [] } = useSpaces();
  const { data: focusAreas = [] } = useFocusAreas();
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [horizonFilter, setHorizonFilter] = useState<string>('');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedItems = useMemo(() => {
    let filtered = horizonFilter ? items.filter((i) => i.horizon === horizonFilter) : items;
    return [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'title': return dir * a.title.localeCompare(b.title);
        case 'type': return dir * a.type.localeCompare(b.type);
        case 'horizon': return dir * ((HORIZON_ORDER[a.horizon] ?? 0) - (HORIZON_ORDER[b.horizon] ?? 0));
        case 'priority': return dir * (a.priority - b.priority);
        case 'effort': return dir * ((a.effort || '').localeCompare(b.effort || ''));
        case 'energy': return dir * ((a.energy || '').localeCompare(b.energy || ''));
        case 'due_date': return dir * ((a.due_date || '9999').localeCompare(b.due_date || '9999'));
        case 'created_at': return dir * a.created_at.localeCompare(b.created_at);
        default: return 0;
      }
    });
  }, [items, sortField, sortDir, horizonFilter]);

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortField === field ? (
          sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-30" />
        )}
      </span>
    </th>
  );

  if (isLoading) {
    return <div className="p-6"><div className="h-96 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" /></div>;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-[1400px] mx-auto p-4">
        {/* Horizon filter */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-slate-500">Filter:</span>
          <button
            onClick={() => setHorizonFilter('')}
            className={clsx('px-2 py-1 rounded text-xs font-medium transition-colors', !horizonFilter ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}
          >
            All
          </button>
          {HORIZONS.map((h) => (
            <button
              key={h.id}
              onClick={() => setHorizonFilter(horizonFilter === h.id ? '' : h.id)}
              className={clsx('px-2 py-1 rounded text-xs font-medium transition-colors', horizonFilter === h.id ? 'text-white' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}
              style={horizonFilter === h.id ? { backgroundColor: h.accentColor } : undefined}
            >
              {h.label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-400">{sortedItems.length} items</span>
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              <Plus size={14} /> New Item
            </button>
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr>
                <SortHeader field="title" label="Title" />
                <SortHeader field="type" label="Type" />
                <SortHeader field="horizon" label="Horizon" />
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Space</th>
                <SortHeader field="priority" label="Priority" />
                <SortHeader field="effort" label="Effort" />
                <SortHeader field="energy" label="Energy" />
                <SortHeader field="due_date" label="Due" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedItems.map((item) => {
                const space = spaces.find((s) => s.id === item.space_id);
                const fa = focusAreas.find((f) => f.id === item.focus_area_id);
                const horizon = HORIZONS.find((h) => h.id === item.horizon);
                const priority = PRIORITIES.find((p) => p.value === item.priority);
                const effort = item.effort ? EFFORTS.find((e) => e.value === item.effort) : null;
                const energy = item.energy ? ENERGIES.find((e) => e.value === item.energy) : null;

                return (
                  <tr
                    key={item.id}
                    onClick={() => setEditingItem(item)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <span className={clsx('text-sm', item.horizon === 'done' && 'line-through text-slate-400')}>
                        {item.title}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 capitalize">{item.type}</td>
                    <td className="px-3 py-2.5">
                      {horizon && (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: horizon.accentColor + '25', color: horizon.accentColor }}>
                          {horizon.label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {space && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: space.color }} />
                          {space.name}
                          {fa && <span className="text-slate-400">/ {fa.name}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {priority && priority.value > 0 && (
                        <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', priority.color)}>{priority.label}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {effort && (
                        <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', effort.color)}>{effort.label}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {energy && (
                        <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', energy.color)}>{energy.label}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{item.due_date || ''}</td>
                  </tr>
                );
              })}
              {sortedItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-sm text-slate-400">
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ItemModal
        isOpen={editingItem !== null || isAdding}
        item={editingItem}
        defaultHorizon={null}
        defaultSpaceId={activeSpaceId}
        defaultFocusAreaId={activeFocusAreaId}
        onClose={() => { setEditingItem(null); setIsAdding(false); }}
      />
    </div>
  );
}
