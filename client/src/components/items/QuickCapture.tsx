import { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { useCreateItem } from '../../hooks/useItems';
import { useSpaces, useActiveSpace } from '../../hooks/useSpaces';
import { ITEM_TYPES } from '../../lib/constants';
import type { ItemType } from '../../types';

interface QuickCaptureProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickCapture({ isOpen, onClose }: QuickCaptureProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ItemType>('task');
  const inputRef = useRef<HTMLInputElement>(null);
  const createItem = useCreateItem();
  const { data: spaces = [] } = useSpaces();
  const { activeSpaceId } = useActiveSpace();

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setType('task');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!title.trim()) return;

    createItem.mutate(
      {
        title: title.trim(),
        type,
        horizon: 'backlog',
        space_id: activeSpaceId,
      },
      {
        onSuccess: () => {
          toast.success('Captured to Backlog');
          onClose();
        },
        onError: () => toast.error('Failed to capture item'),
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl mx-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
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

        <div className="flex items-center gap-2 px-4 py-2.5">
          {ITEM_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={clsx(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                type === t.value
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
            >
              {t.label}
            </button>
          ))}
          <span className="mx-1 text-slate-300 dark:text-slate-700">|</span>
          <span className="text-xs text-slate-400">
            {activeSpaceId
              ? spaces.find((s) => s.id === activeSpaceId)?.name
              : 'No space'}
            {' \u2192 Backlog'}
          </span>
        </div>
      </div>
    </div>
  );
}
