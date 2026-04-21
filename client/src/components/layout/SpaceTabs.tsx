import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Plus, Trash2, Download, Layers, FolderOpen, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useSpaces, useActiveSpace, useDeleteSpace, useUpdateSpace } from '../../hooks/useSpaces';
import { useFocusAreas, useCreateFocusArea, useDeleteFocusArea, useUpdateFocusArea } from '../../hooks/useFocusAreas';
import { downloadSpaceExportJson } from '../../lib/api';

interface SpaceTabsProps {
  onAddSpace: () => void;
}

export function SpaceTabs({ onAddSpace }: SpaceTabsProps) {
  const { data: spaces = [] } = useSpaces();
  const { activeSpaceId, setActiveSpaceId, activeFocusAreaId, setActiveFocusAreaId } = useActiveSpace();
  const { data: focusAreas = [] } = useFocusAreas();
  const createFocusArea = useCreateFocusArea();
  const deleteFocusAreaMut = useDeleteFocusArea();
  const updateFocusArea = useUpdateFocusArea();
  const deleteSpace = useDeleteSpace();
  const updateSpace = useUpdateSpace();
  const [isOpen, setIsOpen] = useState(false);
  const [addingFocusAreaForSpace, setAddingFocusAreaForSpace] = useState<string | null>(null);
  const [newFocusAreaName, setNewFocusAreaName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingType, setEditingType] = useState<'space' | 'focus-area'>('space');
  const ref = useRef<HTMLDivElement>(null);
  const focusAreaInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const activeFocusArea = focusAreas.find((fa) => fa.id === activeFocusAreaId);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (editingId) setTimeout(() => editInputRef.current?.focus(), 30);
  }, [editingId]);

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete space "${name}"? Items in this space will become unassigned.`)) return;
    deleteSpace.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success(`Space "${name}" deleted`);
          if (activeSpaceId === id) setActiveSpaceId(null);
        },
        onError: () => toast.error('Failed to delete space'),
      }
    );
  };

  const startEditing = (e: React.MouseEvent, id: string, name: string, type: 'space' | 'focus-area') => {
    e.stopPropagation();
    setEditingId(id);
    setEditingName(name);
    setEditingType(type);
  };

  const saveEditing = () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }
    if (editingType === 'space') {
      updateSpace.mutate(
        { id: editingId, name: editingName.trim() },
        {
          onSuccess: () => toast.success('Space renamed'),
          onError: () => toast.error('Failed to rename space'),
        }
      );
    } else {
      updateFocusArea.mutate(
        { id: editingId, name: editingName.trim() },
        {
          onSuccess: () => toast.success('Focus area renamed'),
          onError: () => toast.error('Failed to rename focus area'),
        }
      );
    }
    setEditingId(null);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          'hover:bg-slate-100 dark:hover:bg-slate-800',
          isOpen
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
            : 'text-slate-600 dark:text-slate-300'
        )}
      >
        {activeSpace ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: activeSpace.color }} />
            {activeSpace.name}
            {activeFocusArea && (
              <span className="text-slate-400 font-normal">/ {activeFocusArea.name}</span>
            )}
          </>
        ) : (
          <>
            <Layers size={15} className="text-slate-400" />
            All Spaces
          </>
        )}
        <ChevronDown size={14} className={clsx('text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-72 overflow-hidden">
          {/* All spaces option */}
          <div className="p-1.5 border-b border-slate-100 dark:border-slate-700">
            <button
              onClick={() => {
                setActiveSpaceId(null);
                setIsOpen(false);
              }}
              className={clsx(
                'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors',
                activeSpaceId === null
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              )}
            >
              <Layers size={15} className={activeSpaceId === null ? 'text-blue-500' : 'text-slate-400'} />
              <span className="flex-1">All Spaces</span>
              <span className="text-xs text-slate-400">{spaces.length} spaces</span>
            </button>
          </div>

          {/* Spaces list with nested focus areas */}
          <div className="max-h-[400px] overflow-y-auto">
            <div className="px-3 pt-2.5 pb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spaces</span>
            </div>

            <div className="px-1.5 pb-1.5">
              {spaces.map((space) => {
                const spaceFocusAreas = focusAreas.filter((fa) => fa.space_id === space.id);
                const isActiveSpace = activeSpaceId === space.id && !activeFocusAreaId;
                const isEditingSpace = editingId === space.id && editingType === 'space';

                return (
                  <div key={space.id} className="mb-0.5">
                    {/* Space row */}
                    <div
                      className={clsx(
                        'group flex items-center rounded-lg transition-colors',
                        isActiveSpace
                          ? 'bg-blue-50 dark:bg-blue-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      )}
                    >
                      {isEditingSpace ? (
                        <div className="flex items-center gap-2 flex-1 px-3 py-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: space.color }} />
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditing();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            onBlur={saveEditing}
                            className="flex-1 bg-white dark:bg-slate-700 border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none"
                          />
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setActiveSpaceId(space.id);
                              setIsOpen(false);
                            }}
                            className="flex items-center gap-2.5 flex-1 px-3 py-2 text-sm text-left min-w-0"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: space.color }}
                            />
                            <span className={clsx(
                              'truncate',
                              isActiveSpace
                                ? 'text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-slate-600 dark:text-slate-300'
                            )}>
                              {space.name}
                            </span>
                          </button>
                          <button
                            onClick={(e) => startEditing(e, space.id, space.name, 'space')}
                            className="p-1.5 rounded-md text-slate-300 dark:text-slate-600 hover:text-blue-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all"
                            title="Rename space"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadSpaceExportJson(space.id, space.name)
                                .then(() => toast.success(`"${space.name}" exported`))
                                .catch(() => toast.error('Export failed'));
                            }}
                            className="p-1.5 rounded-md text-slate-300 dark:text-slate-600 hover:text-blue-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all"
                            title="Export space"
                          >
                            <Download size={11} />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, space.id, space.name)}
                            className="p-1.5 mr-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete space"
                          >
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Focus areas nested under space */}
                    {spaceFocusAreas.length > 0 && (
                      <div className="ml-5 pl-3 border-l-2 border-slate-100 dark:border-slate-700 mt-0.5 mb-1">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
                          Focus Areas
                        </span>
                        {spaceFocusAreas.map((fa) => {
                          const isEditingFA = editingId === fa.id && editingType === 'focus-area';

                          return (
                            <div
                              key={fa.id}
                              className={clsx(
                                'group flex items-center rounded-md transition-colors',
                                activeFocusAreaId === fa.id
                                  ? 'bg-blue-50 dark:bg-blue-500/10'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                              )}
                            >
                              {isEditingFA ? (
                                <div className="flex items-center gap-1.5 flex-1 px-2 py-1">
                                  <FolderOpen size={12} className="text-slate-400 flex-shrink-0" />
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEditing();
                                      if (e.key === 'Escape') setEditingId(null);
                                    }}
                                    onBlur={saveEditing}
                                    className="flex-1 bg-white dark:bg-slate-700 border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                                  />
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setActiveSpaceId(space.id);
                                      setActiveFocusAreaId(fa.id);
                                      setIsOpen(false);
                                    }}
                                    className="flex items-center gap-1.5 flex-1 px-2 py-1.5 text-left min-w-0"
                                  >
                                    <FolderOpen size={12} className="text-slate-400 flex-shrink-0" />
                                    <span className={clsx(
                                      'truncate text-xs',
                                      activeFocusAreaId === fa.id
                                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                                        : 'text-slate-500 dark:text-slate-400'
                                    )}>
                                      {fa.name}
                                    </span>
                                  </button>
                                  <button
                                    onClick={(e) => startEditing(e, fa.id, fa.name, 'focus-area')}
                                    className="p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Rename"
                                  >
                                    <Pencil size={10} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!confirm(`Delete focus area "${fa.name}"? Items will be unassigned.`)) return;
                                      deleteFocusAreaMut.mutate(fa.id, {
                                        onSuccess: () => {
                                          toast.success(`Focus area "${fa.name}" deleted`);
                                          if (activeFocusAreaId === fa.id) setActiveFocusAreaId(null);
                                        },
                                      });
                                    }}
                                    className="p-1 mr-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Delete focus area"
                                  >
                                    <X size={10} />
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add focus area button */}
                    {addingFocusAreaForSpace === space.id ? (
                      <div className="ml-5 pl-3 border-l-2 border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <FolderOpen size={12} className="text-slate-400 flex-shrink-0" />
                          <input
                            ref={focusAreaInputRef}
                            type="text"
                            value={newFocusAreaName}
                            onChange={(e) => setNewFocusAreaName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newFocusAreaName.trim()) {
                                createFocusArea.mutate(
                                  { name: newFocusAreaName.trim(), space_id: space.id },
                                  {
                                    onSuccess: () => {
                                      setNewFocusAreaName('');
                                      setAddingFocusAreaForSpace(null);
                                      toast.success('Focus area created');
                                    },
                                  }
                                );
                              }
                              if (e.key === 'Escape') {
                                setAddingFocusAreaForSpace(null);
                                setNewFocusAreaName('');
                              }
                            }}
                            onBlur={() => {
                              if (!newFocusAreaName.trim()) {
                                setAddingFocusAreaForSpace(null);
                                setNewFocusAreaName('');
                              }
                            }}
                            placeholder="Focus area name..."
                            className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-700 text-xs py-0.5 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingFocusAreaForSpace(space.id);
                          setNewFocusAreaName('');
                          setTimeout(() => focusAreaInputRef.current?.focus(), 50);
                        }}
                        className="ml-5 pl-3 flex items-center gap-1.5 px-2 py-1 text-[10px] text-slate-400 hover:text-blue-400 transition-colors"
                      >
                        <Plus size={10} />
                        Add focus area
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add space */}
          <div className="p-1.5 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => {
                onAddSpace();
                setIsOpen(false);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <Plus size={15} />
              Add space
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
