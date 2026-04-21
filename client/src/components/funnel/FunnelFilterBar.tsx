import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Search, Filter, Brain, Sun, RotateCw, Check } from 'lucide-react';
import { ENERGIES } from '../../lib/constants';
import type { Space, FocusArea } from '../../types';

const ENERGY_ICONS: Record<string, React.ReactNode> = {
  deep_focus: <Brain size={12} />,
  light: <Sun size={12} />,
  routine: <RotateCw size={12} />,
};

interface FunnelFilterBarProps {
  spaces: Space[];
  focusAreas: FocusArea[];
  selectedFocusAreaIds: Set<string>;
  includeUnassigned: boolean;
  onToggleFocusArea: (id: string) => void;
  onToggleUnassigned: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  energyFilter: string;
  onEnergyFilterChange: (energy: string) => void;
}

export function FunnelFilterBar({
  spaces, focusAreas,
  selectedFocusAreaIds, includeUnassigned,
  onToggleFocusArea, onToggleUnassigned, onSelectAll, onDeselectAll,
  searchQuery, onSearchChange,
  energyFilter, onEnergyFilterChange,
}: FunnelFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalFocusAreas = focusAreas.length + 1;
  const selectedCount = selectedFocusAreaIds.size + (includeUnassigned ? 1 : 0);
  const allSelected = selectedCount === totalFocusAreas;

  const focusAreasBySpace = new Map<string, FocusArea[]>();
  for (const fa of focusAreas) {
    const list = focusAreasBySpace.get(fa.space_id) || [];
    list.push(fa);
    focusAreasBySpace.set(fa.space_id, list);
  }

  return (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 max-w-xs min-w-[180px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter items..."
          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Focus area multi-select dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors',
            isOpen
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
          )}
        >
          <Filter size={14} />
          {allSelected ? 'All areas' : `${selectedCount} area${selectedCount !== 1 ? 's' : ''}`}
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            {/* Select / deselect all */}
            <div className="flex gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700">
              <button onClick={onSelectAll} className="text-[11px] text-blue-500 hover:text-blue-600">Select all</button>
              <span className="text-slate-300">|</span>
              <button onClick={onDeselectAll} className="text-[11px] text-blue-500 hover:text-blue-600">Deselect all</button>
            </div>

            {/* Unassigned */}
            <button
              onClick={onToggleUnassigned}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer w-full text-left"
            >
              <span className={clsx(
                'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                includeUnassigned
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-slate-300 dark:border-slate-600'
              )}>
                {includeUnassigned && <Check size={10} />}
              </span>
              <span className="text-xs text-slate-500 italic">Unassigned</span>
            </button>

            {/* Grouped by space */}
            {spaces.map((space) => {
              const spaceFAs = focusAreasBySpace.get(space.id) || [];
              if (spaceFAs.length === 0) return null;

              return (
                <div key={space.id}>
                  <div className="px-3 pt-2 pb-0.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: space.color }} />
                      {space.name}
                    </span>
                  </div>
                  {spaceFAs.map((fa) => {
                    const isSelected = selectedFocusAreaIds.has(fa.id);
                    return (
                      <button
                        key={fa.id}
                        onClick={() => onToggleFocusArea(fa.id)}
                        className="flex items-center gap-2 px-3 pl-6 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer w-full text-left"
                      >
                        <span className={clsx(
                          'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        )}>
                          {isSelected && <Check size={10} />}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300">{fa.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Energy filter */}
      <div className="flex gap-1.5">
        <button
          onClick={() => onEnergyFilterChange('')}
          className={clsx(
            'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
            !energyFilter ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          All
        </button>
        {ENERGIES.map((e) => (
          <button
            key={e.value}
            onClick={() => onEnergyFilterChange(energyFilter === e.value ? '' : e.value)}
            className={clsx(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              energyFilter === e.value ? e.color : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            {ENERGY_ICONS[e.value]}
            {e.label}
          </button>
        ))}
      </div>
    </div>
  );
}
