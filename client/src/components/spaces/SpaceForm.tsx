import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { SPACE_COLORS } from '../../lib/constants';
import { useCreateSpace } from '../../hooks/useSpaces';
import { clsx } from 'clsx';

interface SpaceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SpaceForm({ isOpen, onClose }: SpaceFormProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(SPACE_COLORS[0]!);
  const inputRef = useRef<HTMLInputElement>(null);
  const createSpace = useCreateSpace();

  useEffect(() => {
    if (isOpen) {
      setName('');
      setColor(SPACE_COLORS[0]!);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!name.trim()) {
      inputRef.current?.focus();
      return;
    }

    createSpace.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => {
          toast.success(`Space "${name}" created`);
          onClose();
        },
        onError: () => toast.error('Failed to create space'),
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Space">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder="e.g. Side Projects"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
          <div className="flex gap-2">
            {SPACE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={clsx(
                  'w-7 h-7 rounded-full transition-transform',
                  color === c && 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 scale-110'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createSpace.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
          >
            Create Space
          </button>
        </div>
      </div>
    </Modal>
  );
}
