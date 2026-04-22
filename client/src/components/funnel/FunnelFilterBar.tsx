import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Search, Filter, Brain, Sun, RotateCw, Check, ChevronDown } from 'lucide-react';
import { ENERGIES, EFFORTS, PRIORITIES } from '../../lib/constants';
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
  priorityFilter: number | null;
  onPriorityFilterChange: (priority: number | null) => void;
  effortFilter: string;
  onEffortFilterChange: (effort: string) => void;
  selectedSpaceIds: Set<string>;
  onToggleSpace: (id: string) => void;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-0.5">{label}</span>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children, color }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
        active
          ? color || 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
    >
      {children}
    </button>
  );
}

export function FunnelFilterBar({
  spaces, focusAreas,
  selectedFocusAreaIds, includeUnassigned,
  onToggleFocusArea, onToggleUnassigned, onSelectAll, onDeselectAll,
  searchQuery, onSearchChange,
  energyFilter, onEnergyFilterChange,
  priorityFilter, onPriorityFilterChange,
  effortFilter, onEffortFilterChange,
  selectedSpaceIds, onToggleSpace,
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

  const allSpacesSelected = spaces.every((s) => selectedSpaceIds.has(s.id));

  return (
    <div className="space-y-3 mb-5">
      {/* Row 1: Search + Space pills + Focus area dropdown */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter items..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Space pills */}
        <FilterGroup label="Space">
          <Pill active={allSpacesSelected} onClick={() => {
            if (allSpacesSelected) {
              spaces.forEach((s) => { if (selectedSpaceIds.has(s.id)) onToggleSpace(s.id); });
            } else {
              spaces.forEach((s) => { if (!selectedSpaceIds.has(s.id)) onToggleSpace(s.id); });
            }
          }}>
            All
          </Pill>
          {spaces.map((space) => (
            <Pill
              key={space.id}
              active={selectedSpaceIds.has(space.id)}
              onClick={() => onToggleSpace(space.id)}
              color={selectedSpaceIds.has(space.id)
                ? undefined
                : undefined
              }
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: space.color, opacity: selectedSpaceIds.has(space.id) ? 1 : 0.4 }}
                />
                {space.name}
              </span>
            </Pill>
          ))}
        </FilterGroup>

        {/* Focus area dropdown (fine-grained) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              isOpen
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300'
            )}
          >
            <Filter size={12} />
            {allSelected ? 'All areas' : `${selectedCount} area${selectedCount !== 1 ? 's' : ''}`}
            <ChevronDown size={10} className={clsx('transition-transform', isOpen && 'rotate-180')} />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
              <div className="flex gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                <button onClick={onSelectAll} className="text-[11px] text-blue-500 hover:text-blue-600">Select all</button>
                <span className="text-slate-300">|</span>
                <button onClick={onDeselectAll} className="text-[11px] text-blue-500 hover:text-blue-600">Deselect all</button>
              </div>

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
      </div>

      {/* Row 2: Energy + Priority + Effort */}
      <div className="flex items-center gap-4 flex-wrap">
        <FilterGroup label="Energy">
          <Pill active={!energyFilter} onClick={() => onEnergyFilterChange('')}>All</Pill>
          {ENERGIES.map((e) => (
            <Pill
              key={e.value}
              active={energyFilter === e.value}
              onClick={() => onEnergyFilterChange(energyFilter === e.value ? '' : e.value)}
            >
              <span className="flex items-center gap-1">
                {ENERGY_ICONS[e.value]}
                {e.label}
              </span>
            </Pill>
          ))}
        </FilterGroup>

        <span className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

        <FilterGroup label="Priority">
          <Pill active={priorityFilter === null} onClick={() => onPriorityFilterChange(null)}>All</Pill>
          {PRIORITIES.filter((p) => p.value > 0).map((p) => (
            <Pill
              key={p.value}
              active={priorityFilter === p.value}
              onClick={() => onPriorityFilterChange(priorityFilter === p.value ? null : p.value)}
            >
              {p.label}
            </Pill>
          ))}
        </FilterGroup>

        <span className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

        <FilterGroup label="Effort">
          <Pill active={!effortFilter} onClick={() => onEffortFilterChange('')}>All</Pill>
          {EFFORTS.map((e) => (
            <Pill
              key={e.value}
              active={effortFilter === e.value}
              onClick={() => onEffortFilterChange(effortFilter === e.value ? '' : e.value)}
            >
              {e.label}
            </Pill>
          ))}
        </FilterGroup>
      </div>
    </div>
  );
}
