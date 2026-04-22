import { Droppable, Draggable } from '@hello-pangea/dnd';
import { clsx } from 'clsx';
import { FunnelItemRow } from './FunnelItemRow';
import type { Item, Space, FocusArea, Horizon } from '../../types';

interface FunnelColumnProps {
  horizon: Horizon;
  focusAreaId: string;
  label: string;
  color?: string;
  items: Item[];
  compact: boolean;
  spaces: Space[];
  focusAreas: FocusArea[];
  onEditItem: (item: Item) => void;
}

export function FunnelColumn({
  horizon, focusAreaId, label, color, items, compact, spaces, focusAreas, onEditItem,
}: FunnelColumnProps) {
  const droppableId = `${horizon}:${focusAreaId}`;

  return (
    <div className="min-w-[260px] flex-1">
      <div className="flex items-center gap-1.5 mb-1 px-1">
        {color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
          {label}
        </span>
        <span className="text-[10px] text-slate-400 tabular-nums">{items.length}</span>
      </div>

      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={clsx(
              'rounded-lg border border-dashed min-h-[40px] p-1.5 transition-colors',
              snapshot.isDraggingOver
                ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                : 'border-transparent'
            )}
          >
            {items.map((item, idx) => (
              <Draggable draggableId={item.id} index={idx} key={item.id}>
                {(prov, snap) => (
                  <FunnelItemRow
                    item={item}
                    compact={compact}
                    spaces={spaces}
                    focusAreas={focusAreas}
                    showSpaceLabel={false}
                    isDragging={snap.isDragging}
                    provided={prov}
                    onClick={() => onEditItem(item)}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {items.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-[10px] text-slate-400 text-center py-2">—</p>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
