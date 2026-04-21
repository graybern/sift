import { useState, useMemo, useCallback } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { Archive, CalendarClock, Timer, Zap, ChevronsDown } from 'lucide-react';
import { useItems, useUpdateItem } from '../../hooks/useItems';
import { useSpaces } from '../../hooks/useSpaces';
import { useFocusAreas } from '../../hooks/useFocusAreas';
import { ItemModal } from '../items/ItemModal';
import { FunnelFilterBar } from './FunnelFilterBar';
import { FunnelTier } from './FunnelTier';
import type { Item, Horizon, UpdateItemInput } from '../../types';

const UNASSIGNED_ID = '__unassigned__';

const TIERS = [
  { id: 'backlog' as Horizon, label: 'Backlog', Icon: Archive, color: '#64748b', bg: 'bg-slate-50 dark:bg-slate-800/30' },
  { id: 'later' as Horizon, label: 'Later', Icon: CalendarClock, color: '#8b5cf6', bg: 'bg-purple-50/30 dark:bg-purple-900/10' },
  { id: 'soon' as Horizon, label: 'Soon', Icon: Timer, color: '#f59e0b', bg: 'bg-amber-50/30 dark:bg-amber-900/10' },
  { id: 'now' as Horizon, label: 'Now', Icon: Zap, color: '#3b82f6', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
];

const TIER_MAX_WIDTHS = ['100%', '80%', '64%', '50%'];

export function FunnelView() {
  const { data: items = [] } = useItems();
  const { data: spaces = [] } = useSpaces();
  const { data: focusAreas = [] } = useFocusAreas();
  const updateItem = useUpdateItem();

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [energyFilter, setEnergyFilter] = useState('');
  const [selectedFocusAreaIds, setSelectedFocusAreaIds] = useState<Set<string> | null>(null);
  const [includeUnassigned, setIncludeUnassigned] = useState(true);

  // Initialize selection to all focus areas on first render
  const effectiveSelected = useMemo(() => {
    if (selectedFocusAreaIds !== null) return selectedFocusAreaIds;
    return new Set(focusAreas.map((fa) => fa.id));
  }, [selectedFocusAreaIds, focusAreas]);

  const toggleFocusArea = useCallback((id: string) => {
    setSelectedFocusAreaIds((prev) => {
      const current = prev ?? new Set(focusAreas.map((fa) => fa.id));
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [focusAreas]);

  const selectAll = useCallback(() => {
    setSelectedFocusAreaIds(new Set(focusAreas.map((fa) => fa.id)));
    setIncludeUnassigned(true);
  }, [focusAreas]);

  const deselectAll = useCallback(() => {
    setSelectedFocusAreaIds(new Set());
    setIncludeUnassigned(false);
  }, []);

  // Build the column definitions for selected focus areas
  const selectedColumns = useMemo(() => {
    const cols: { focusAreaId: string; label: string; color?: string }[] = [];

    if (includeUnassigned) {
      cols.push({ focusAreaId: UNASSIGNED_ID, label: 'Unassigned', color: undefined });
    }

    for (const fa of focusAreas) {
      if (!effectiveSelected.has(fa.id)) continue;
      const space = spaces.find((s) => s.id === fa.space_id);
      cols.push({
        focusAreaId: fa.id,
        label: space ? `${space.name}: ${fa.name}` : fa.name,
        color: space?.color,
      });
    }

    return cols;
  }, [effectiveSelected, includeUnassigned, focusAreas, spaces]);

  // Group items: horizon -> focusAreaId -> Item[]
  const groupedItems = useMemo(() => {
    const result = new Map<Horizon, Map<string, Item[]>>();
    for (const tier of TIERS) {
      result.set(tier.id, new Map());
    }

    for (const item of items) {
      if (item.horizon === 'done') continue;

      if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) continue;
      if (energyFilter && item.energy !== energyFilter) continue;

      const columnId = item.focus_area_id || UNASSIGNED_ID;

      // Only include items for selected columns
      if (columnId === UNASSIGNED_ID && !includeUnassigned) continue;
      if (columnId !== UNASSIGNED_ID && !effectiveSelected.has(columnId)) continue;

      const horizonMap = result.get(item.horizon as Horizon);
      if (!horizonMap) continue;

      const list = horizonMap.get(columnId) || [];
      list.push(item);
      horizonMap.set(columnId, list);
    }

    // Sort items within each column by position
    for (const horizonMap of result.values()) {
      for (const [key, list] of horizonMap) {
        horizonMap.set(key, list.sort((a, b) => a.position - b.position));
      }
    }

    return result;
  }, [items, searchQuery, energyFilter, effectiveSelected, includeUnassigned]);

  const handleDragEnd = (result: DropResult) => {
    const { draggableId, destination, source } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // Parse compound droppableId: "{horizon}:{focusAreaId}"
    const [destHorizon, destFocusAreaId] = destination.droppableId.split(':') as [Horizon, string];
    const [, srcFocusAreaId] = source.droppableId.split(':');

    const item = items.find((i) => i.id === draggableId);
    if (!item) return;

    const updates: UpdateItemInput = { id: draggableId };

    if (item.horizon !== destHorizon) {
      updates.horizon = destHorizon;
    }

    // Focus area change
    if (srcFocusAreaId !== destFocusAreaId) {
      if (destFocusAreaId === UNASSIGNED_ID) {
        updates.focus_area_id = null;
        updates.space_id = null;
      } else {
        updates.focus_area_id = destFocusAreaId;
        const targetFA = focusAreas.find((fa) => fa.id === destFocusAreaId);
        if (targetFA) updates.space_id = targetFA.space_id;
      }
    }

    updateItem.mutate(updates, {
      onError: () => toast.error('Failed to move item'),
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <FunnelFilterBar
          spaces={spaces}
          focusAreas={focusAreas}
          selectedFocusAreaIds={effectiveSelected}
          includeUnassigned={includeUnassigned}
          onToggleFocusArea={toggleFocusArea}
          onToggleUnassigned={() => setIncludeUnassigned((v) => !v)}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          energyFilter={energyFilter}
          onEnergyFilterChange={setEnergyFilter}
        />

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-1">
            {TIERS.map((tier, tierIndex) => {
              const horizonMap = groupedItems.get(tier.id) || new Map();
              let totalItems = 0;
              for (const list of horizonMap.values()) totalItems += list.length;

              return (
                <div key={tier.id}>
                  {tierIndex > 0 && (
                    <div className="flex justify-center py-1.5">
                      <ChevronsDown size={16} className="text-slate-300 dark:text-slate-600" />
                    </div>
                  )}
                  <div
                    className="mx-auto transition-all duration-300"
                    style={{ maxWidth: TIER_MAX_WIDTHS[tierIndex] }}
                  >
                    <FunnelTier
                      tier={tier}
                      columns={selectedColumns}
                      itemsByColumn={horizonMap}
                      totalItems={totalItems}
                      spaces={spaces}
                      focusAreas={focusAreas}
                      onEditItem={setEditingItem}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      <ItemModal
        isOpen={editingItem !== null}
        item={editingItem}
        defaultHorizon={null}
        onClose={() => setEditingItem(null)}
      />
    </div>
  );
}
