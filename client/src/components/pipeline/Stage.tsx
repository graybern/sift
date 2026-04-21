import { Droppable, Draggable } from '@hello-pangea/dnd';
import { clsx } from 'clsx';
import { StageHeader } from './StageHeader';
import { ItemCard } from '../items/ItemCard';
import type { HorizonConfig } from '../../lib/constants';
import type { Item, Space } from '../../types';

interface StageProps {
  stage: HorizonConfig;
  items: Item[];
  spaces: Space[];
  showSpaces: boolean;
  onAddItem: (horizon: string) => void;
  onEditItem: (item: Item) => void;
  onDeleteItem: (id: string) => void;
}

const EMPTY_MESSAGES: Record<string, string> = {
  backlog: 'Nothing here yet. Use \u2318K to capture something.',
  later: 'Nothing on the radar. Promote items from Backlog.',
  soon: 'Nothing coming up. Pull items closer when ready.',
  now: 'Drag items here to focus on them.',
  done: 'Nothing completed yet. You\'ve got this!',
};

export function Stage({ stage, items, spaces, showSpaces, onAddItem, onEditItem, onDeleteItem }: StageProps) {
  return (
    <div className="flex flex-col min-h-0 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      <StageHeader
        stage={stage}
        items={items}
        onAdd={() => onAddItem(stage.id)}
      />

      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={clsx(
              'flex-1 overflow-y-auto px-2 pb-2 space-y-1.5 min-h-[80px] transition-colors rounded-b-xl',
              snapshot.isDraggingOver && 'bg-slate-200/50 dark:bg-slate-800/50'
            )}
          >
            {items.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-slate-400 dark:text-slate-600 text-center py-6 px-2 italic">
                {EMPTY_MESSAGES[stage.id]}
              </p>
            )}
            {items.map((item, index) => {
              const space = spaces.find((s) => s.id === item.space_id);
              return (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(dragProvided) => (
                    <ItemCard
                      item={item}
                      provided={dragProvided}
                      onClick={() => onEditItem(item)}
                      onDelete={() => onDeleteItem(item.id)}
                      spaceColor={space?.color}
                      showSpace={showSpaces}
                    />
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
