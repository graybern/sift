import { useState, useEffect, useRef } from 'react';
import { Zap, Brain, Sun, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { useCreateItem } from '../../hooks/useItems';
import { useSpaces, useActiveSpace } from '../../hooks/useSpaces';
import { useFocusAreas } from '../../hooks/useFocusAreas';
import { ITEM_TYPES, HORIZONS, PRIORITIES, EFFORTS, ENERGIES } from '../../lib/constants';
import type { ItemType, Horizon, Priority, Effort, Energy } from '../../types';

const ENERGY_ICONS: Record<string, React.ReactNode> = {
  deep_focus: <Brain size={11} />,
  light: <Sun size={11} />,
  routine: <RotateCw size={11} />,
};

interface QuickCaptureProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickCapture({ isOpen, onClose }: QuickCaptureProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ItemType>('task');
  const [spaceId, setSpaceId] = useState('');
  const [focusAreaId, setFocusAreaId] = useState('');
  const [horizon, setHorizon] = useState<Horizon>('backlog');
  const [priority, setPriority] = useState<Priority>(0);
  const [effort, setEffort] = useState<Effort | ''>('');
  const [energy, setEnergy] = useState<Energy | ''>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createItem = useCreateItem();
  const { data: spaces = [] } = useSpaces();
  const { activeSpaceId, activeFocusAreaId } = useActiveSpace();
  const { data: allFocusAreas = [] } = useFocusAreas();

  const spaceFocusAreas = spaceId
    ? allFocusAreas.filter((fa) => fa.space_id === spaceId)
    : [];

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setType('task');
      setSpaceId(activeSpaceId || '');
      setFocusAreaId(activeFocusAreaId || '');
      setHorizon('backlog');
      setPriority(0);
      setEffort('');
      setEnergy('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, activeSpaceId, activeFocusAreaId]);

  const handleSubmit = () => {
    if (!title.trim()) return;

    createItem.mutate(
      {
        title: title.trim(),
        type,
        horizon,
        priority,
        effort: effort || undefined,
        energy: energy || undefined,
        space_id: spaceId || undefined,
        focus_area_id: focusAreaId || undefined,
      },
      {
        onSuccess: () => {
          const h = HORIZONS.find((h) => h.id === horizon);
          toast.success(`Captured to ${h?.label || 'Backlog'}`);
          onClose();
        },
        onError: () => toast.error('Failed to capture item'),
      }
    );
  };

  if (!isOpen) return null;

  const activeHorizon = HORIZONS.find((h) => h.id === horizon);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl mx-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Zap size={18} className="text-amber-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="What's on your mind?"
            className="flex-1 bg-transparent text-base placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] text-slate-400 font-mono">
            Enter
          </kbd>
        </div>

        {/* Type + Space + Focus Area + Horizon row */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex-wrap">
          {/* Type */}
          <div className="flex gap-0.5">
            {ITEM_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={clsx(
                  'px-2 py-1 rounded text-xs font-medium transition-colors',
                  type === t.value
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

          {/* Space selector */}
          <select
            value={spaceId}
            onChange={(e) => { setSpaceId(e.target.value); setFocusAreaId(''); }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">No space</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Focus area selector */}
          {spaceFocusAreas.length > 0 && (
            <select
              value={focusAreaId}
              onChange={(e) => setFocusAreaId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">No focus area</option>
              {spaceFocusAreas.map((fa) => (
                <option key={fa.id} value={fa.id}>{fa.name}</option>
              ))}
            </select>
          )}

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

          {/* Destination summary */}
          <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto">
            {'\u2192'}
            <span className="font-medium" style={{ color: activeHorizon?.accentColor }}>{activeHorizon?.label}</span>
          </span>
        </div>

        {/* Pills row: Horizon + Priority + Effort + Energy */}
        <div className="flex items-center gap-1 px-4 py-2 flex-wrap">
          {/* Horizon pills */}
          {HORIZONS.filter((h) => h.id !== 'done').map((h) => (
            <button
              key={h.id}
              onClick={() => setHorizon(h.id)}
              className={clsx(
                'px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                horizon === h.id
                  ? 'text-white'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
              style={horizon === h.id ? { backgroundColor: h.accentColor } : undefined}
            >
              {h.label}
            </button>
          ))}

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Priority pills */}
          {PRIORITIES.filter((p) => p.value > 0).map((p) => (
            <button
              key={p.value}
              onClick={() => setPriority(priority === p.value ? 0 : p.value)}
              className={clsx(
                'px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                priority === p.value
                  ? p.color
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
            >
              {p.label}
            </button>
          ))}

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Effort pills */}
          {EFFORTS.map((e) => (
            <button
              key={e.value}
              onClick={() => setEffort(effort === e.value ? '' : e.value)}
              className={clsx(
                'px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                effort === e.value
                  ? e.color
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
            >
              {e.label}
            </button>
          ))}

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Energy pills */}
          {ENERGIES.map((e) => (
            <button
              key={e.value}
              onClick={() => setEnergy(energy === e.value ? '' : e.value)}
              className={clsx(
                'flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                energy === e.value
                  ? e.color
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
            >
              {ENERGY_ICONS[e.value]}
              {e.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
