import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useItems } from '../../hooks/useItems';
import { useActiveSpace } from '../../hooks/useSpaces';
import { ItemModal } from '../items/ItemModal';
import { HORIZONS } from '../../lib/constants';
import type { Item } from '../../types';

export function CalendarView() {
  const { activeSpaceId, activeFocusAreaId } = useActiveSpace();
  const filters = activeFocusAreaId
    ? { focus_area_id: activeFocusAreaId }
    : activeSpaceId
      ? { space_id: activeSpaceId }
      : undefined;
  const { data: items = [] } = useItems(filters);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [addingWithDate, setAddingWithDate] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const itemsByDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      if (item.due_date && item.horizon !== 'done') {
        const existing = map.get(item.due_date) || [];
        existing.push(item);
        map.set(item.due_date, existing);
      }
    }
    return map;
  }, [items]);

  const undatedItems = useMemo(
    () => items.filter((i) => !i.due_date && i.horizon !== 'done'),
    [items]
  );

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="h-full overflow-auto flex">
      {/* Calendar grid */}
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-lg font-semibold min-w-[180px] text-center">{monthLabel}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setAddingWithDate(todayStr)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              <Plus size={14} /> New Item
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="px-2 py-2 text-xs font-medium text-slate-500 text-center">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className="min-h-[100px] border-b border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayItems = itemsByDate.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const isPast = dateStr < todayStr;

              return (
                <div
                  key={i}
                  className={clsx(
                    'group min-h-[100px] border-b border-r border-slate-100 dark:border-slate-800 p-1',
                    isToday && 'bg-blue-50/50 dark:bg-blue-500/5'
                  )}
                >
                  <div className={clsx(
                    'flex items-center justify-between text-xs font-medium mb-1 px-1',
                    isToday ? 'text-blue-500' : isPast ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500'
                  )}>
                    <span>
                      {isToday ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px]">{day}</span>
                      ) : day}
                    </span>
                    <button
                      onClick={() => setAddingWithDate(dateStr)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => {
                      const horizon = HORIZONS.find((h) => h.id === item.horizon);
                      return (
                        <button
                          key={item.id}
                          onClick={() => setEditingItem(item)}
                          className="w-full text-left px-1 py-0.5 rounded text-[10px] leading-tight truncate hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: (horizon?.accentColor || '#64748b') + '20', color: horizon?.accentColor }}
                        >
                          {item.title}
                        </button>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <span className="text-[10px] text-slate-400 px-1">+{dayItems.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar: undated items grouped by horizon */}
      <div className="w-64 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 overflow-y-auto hidden lg:block">
        <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">No Due Date</h3>
        {HORIZONS.filter((h) => h.id !== 'done').map((h) => {
          const horizonItems = undatedItems.filter((i) => i.horizon === h.id);
          if (horizonItems.length === 0) return null;
          return (
            <div key={h.id} className="mb-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: h.accentColor }} />
                <span className="text-xs font-medium text-slate-500">{h.label}</span>
                <span className="text-[10px] text-slate-400 ml-auto">{horizonItems.length}</span>
              </div>
              <div className="space-y-1">
                {horizonItems.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setEditingItem(item)}
                    className="w-full text-left text-xs text-slate-600 dark:text-slate-400 truncate hover:text-slate-900 dark:hover:text-white px-1.5 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {item.title}
                  </button>
                ))}
                {horizonItems.length > 8 && (
                  <span className="text-[10px] text-slate-400 px-1.5">+{horizonItems.length - 8} more</span>
                )}
              </div>
            </div>
          );
        })}
        {undatedItems.length === 0 && (
          <p className="text-xs text-slate-400">All items have due dates.</p>
        )}
      </div>

      <ItemModal
        isOpen={editingItem !== null || addingWithDate !== null}
        item={editingItem}
        defaultHorizon={null}
        defaultDueDate={addingWithDate}
        onClose={() => { setEditingItem(null); setAddingWithDate(null); }}
      />
    </div>
  );
}
