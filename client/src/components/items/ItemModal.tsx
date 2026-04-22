import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { SubTaskList } from './SubTaskList';
import { HORIZONS, PRIORITIES, EFFORTS, ENERGIES, ITEM_TYPES } from '../../lib/constants';
import { useCreateItem, useUpdateItem } from '../../hooks/useItems';
import { useSpaces, useActiveSpace } from '../../hooks/useSpaces';
import { useFocusAreas } from '../../hooks/useFocusAreas';
import { useTags, useCreateTag, useAddTagToItem, useRemoveTagFromItem } from '../../hooks/useTags';
import type { Item, Horizon, ItemType, Priority, Effort, Energy, Tag } from '../../types';
import { clsx } from 'clsx';

const TAG_COLORS = ['#6b7280', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

interface ItemModalProps {
  isOpen: boolean;
  item: Item | null;
  defaultHorizon: Horizon | null;
  defaultSpaceId?: string | null;
  defaultFocusAreaId?: string | null;
  defaultDueDate?: string | null;
  onClose: () => void;
}

export function ItemModal({ isOpen, item, defaultHorizon, defaultSpaceId, defaultFocusAreaId, defaultDueDate, onClose }: ItemModalProps) {
  const isEditing = item !== null;
  const { data: spaces = [] } = useSpaces();
  const { activeSpaceId } = useActiveSpace();
  const { data: allFocusAreas = [] } = useFocusAreas();
  const { data: allTags = [] } = useTags();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const createTag = useCreateTag();
  const addTagToItem = useAddTagToItem();
  const removeTagFromItem = useRemoveTagFromItem();
  const titleRef = useRef<HTMLInputElement>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ItemType>('task');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [spaceId, setSpaceId] = useState<string>('');
  const [focusAreaId, setFocusAreaId] = useState<string>('');
  const [horizon, setHorizon] = useState<Horizon>('backlog');
  const [priority, setPriority] = useState<Priority>(0);
  const [effort, setEffort] = useState<Effort | ''>('');
  const [energy, setEnergy] = useState<Energy | ''>('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setTitle(item.title);
        setType(item.type);
        setDescription(item.description || '');
        setUrl(item.url || '');
        setSpaceId(item.space_id || '');
        setFocusAreaId(item.focus_area_id || '');
        setHorizon(item.horizon);
        setPriority(item.priority);
        setEffort((item.effort as Effort) || '');
        setEnergy((item.energy as Energy) || '');
        setDueDate(item.due_date || '');
      } else {
        setTitle('');
        setType('task');
        setDescription('');
        setUrl('');
        setSpaceId(defaultSpaceId ?? activeSpaceId ?? '');
        setFocusAreaId(defaultFocusAreaId ?? '');
        setHorizon(defaultHorizon || 'backlog');
        setPriority(0);
        setEffort('');
        setEnergy('');
        setDueDate(defaultDueDate ?? '');
      }
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen, item, defaultHorizon, defaultSpaceId, defaultFocusAreaId, defaultDueDate, activeSpaceId]);

  const handleSubmit = () => {
    if (!title.trim()) {
      titleRef.current?.focus();
      return;
    }

    const data = {
      title: title.trim(),
      type,
      description: description || undefined,
      url: url || undefined,
      space_id: spaceId || null,
      focus_area_id: focusAreaId || null,
      horizon,
      priority,
      effort: effort || undefined,
      energy: energy || undefined,
      due_date: dueDate || undefined,
    };

    if (isEditing) {
      updateItem.mutate(
        { id: item.id, ...data },
        {
          onSuccess: () => {
            toast.success('Item updated');
            onClose();
          },
          onError: () => toast.error('Failed to update item'),
        }
      );
    } else {
      createItem.mutate(data, {
        onSuccess: () => {
          toast.success('Item created');
          onClose();
        },
        onError: () => toast.error('Failed to create item'),
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Item' : 'New Item'}
    >
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        {/* Title */}
        <div>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full bg-transparent border-0 border-b border-slate-200 dark:border-slate-700 px-0 py-2 text-base font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Type selector */}
        <div className="flex gap-1">
          {ITEM_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                type === t.value
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* URL (for link type) */}
        {type === 'link' && (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        )}

        {/* Description */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details..."
          rows={3}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-blue-500 transition-colors"
        />

        {/* Space, Focus Area & Horizon */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Space</label>
            <select
              value={spaceId}
              onChange={(e) => { setSpaceId(e.target.value); setFocusAreaId(''); }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">No space</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Focus Area</label>
            <select
              value={focusAreaId}
              onChange={(e) => setFocusAreaId(e.target.value)}
              disabled={!spaceId}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">None</option>
              {allFocusAreas.filter((fa) => fa.space_id === spaceId).map((fa) => (
                <option key={fa.id} value={fa.id}>{fa.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Horizon</label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as Horizon)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {HORIZONS.map((h) => (
                <option key={h.id} value={h.id}>{h.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority & Effort */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
            <div className="flex gap-1">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={clsx(
                    'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
                    priority === p.value
                      ? p.value === 0 ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : p.color
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Effort</label>
            <div className="flex gap-1">
              {EFFORTS.map((e) => (
                <button
                  key={e.value}
                  onClick={() => setEffort(effort === e.value ? '' : e.value)}
                  className={clsx(
                    'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
                    effort === e.value
                      ? e.color
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Energy */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Energy</label>
          <div className="flex gap-1">
            {ENERGIES.map((e) => (
              <button
                key={e.value}
                onClick={() => setEnergy(energy === e.value ? '' : e.value)}
                className={clsx(
                  'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
                  energy === e.value
                    ? e.color
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags (only for existing items) */}
        {isEditing && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tags</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {(item.tags || []).map((tag: Tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                  <button
                    onClick={() => removeTagFromItem.mutate({ itemId: item.id, tagId: tag.id })}
                    className="hover:opacity-70"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <div className="relative" ref={tagDropdownRef}>
                <button
                  onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:text-blue-400 transition-colors"
                >
                  <Plus size={10} /> Tag
                </button>
                {tagDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {allTags
                      .filter((t) => !(item.tags || []).some((it: Tag) => it.id === t.id))
                      .map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            addTagToItem.mutate({ itemId: item.id, tagId: tag.id });
                            setTagDropdownOpen(false);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left"
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                          <span className="text-xs text-slate-600 dark:text-slate-300">{tag.name}</span>
                        </button>
                      ))}
                    <div className="border-t border-slate-100 dark:border-slate-700 p-2">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="New tag..."
                          className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newTagName.trim()) {
                              e.stopPropagation();
                              const color = TAG_COLORS[allTags.length % TAG_COLORS.length];
                              createTag.mutate(
                                { name: newTagName.trim(), color },
                                {
                                  onSuccess: (tag) => {
                                    addTagToItem.mutate({ itemId: item.id, tagId: tag.id });
                                    setNewTagName('');
                                    setTagDropdownOpen(false);
                                  },
                                }
                              );
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (!newTagName.trim()) return;
                            const color = TAG_COLORS[allTags.length % TAG_COLORS.length];
                            createTag.mutate(
                              { name: newTagName.trim(), color },
                              {
                                onSuccess: (tag) => {
                                  addTagToItem.mutate({ itemId: item.id, tagId: tag.id });
                                  setNewTagName('');
                                  setTagDropdownOpen(false);
                                },
                              }
                            );
                          }}
                          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Due date */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Sub-tasks (only for existing items) */}
        {isEditing && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <SubTaskList parentId={item.id} spaceId={item.space_id} />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createItem.isPending || updateItem.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
          >
            {isEditing ? 'Save' : 'Create'}
            <span className="ml-2 text-[10px] opacity-60">{'\u2318'}Enter</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
