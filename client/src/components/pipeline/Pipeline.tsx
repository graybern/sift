import { useState, useCallback } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { Stage } from './Stage';
import { ItemModal } from '../items/ItemModal';
import { HORIZONS } from '../../lib/constants';
import { useItems, useMoveItem, useDeleteItem } from '../../hooks/useItems';
import { useSpaces, useActiveSpace } from '../../hooks/useSpaces';
import type { Item, Horizon } from '../../types';

export function Pipeline() {
  const { activeSpaceId, activeFocusAreaId } = useActiveSpace();
  const filters = activeFocusAreaId
    ? { focus_area_id: activeFocusAreaId }
    : activeSpaceId
      ? { space_id: activeSpaceId }
      : undefined;
  const { data: items = [], isLoading } = useItems(filters);
  const { data: spaces = [] } = useSpaces();
  const moveItem = useMoveItem();
  const deleteItem = useDeleteItem();

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [addingToHorizon, setAddingToHorizon] = useState<Horizon | null>(null);

  const itemsByHorizon = useCallback(
    (horizonId: string) =>
      items
        .filter((item) => item.horizon === horizonId)
        .sort((a, b) => a.position - b.position),
    [items]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { draggableId, destination, source } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;

      const newHorizon = destination.droppableId as Horizon;

      moveItem.mutate(
        { id: draggableId, horizon: newHorizon, position: destination.index },
        {
          onError: () => toast.error('Failed to move item'),
        }
      );
    },
    [moveItem]
  );

  const handleDeleteItem = useCallback(
    (id: string) => {
      deleteItem.mutate(id, {
        onSuccess: () => toast.success('Item deleted'),
        onError: () => toast.error('Failed to delete item'),
      });
    },
    [deleteItem]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 h-full">
        {HORIZONS.map((h) => (
          <div
            key={h.id}
            className="bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse"
          >
            <div className="p-3">
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 h-full auto-rows-min md:auto-rows-fr">
          {HORIZONS.map((h) => (
            <Stage
              key={h.id}
              stage={h}
              items={itemsByHorizon(h.id)}
              spaces={spaces}
              showSpaces={activeSpaceId === null}
              onAddItem={(horizonId) => setAddingToHorizon(horizonId as Horizon)}
              onEditItem={setEditingItem}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      </DragDropContext>

      <ItemModal
        isOpen={editingItem !== null || addingToHorizon !== null}
        item={editingItem}
        defaultHorizon={addingToHorizon}
        onClose={() => {
          setEditingItem(null);
          setAddingToHorizon(null);
        }}
      />
    </>
  );
}
