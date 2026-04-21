import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { AlertTriangle, FolderOpen, FileText, Tag } from 'lucide-react';
import type { ImportPreview } from '../../types';

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: ImportPreview | null;
  onConfirm: (options: { importSettings: boolean }) => void;
  isImporting: boolean;
}

export function ImportPreviewModal({ isOpen, onClose, preview, onConfirm, isImporting }: ImportPreviewModalProps) {
  const [importSettings, setImportSettings] = useState(false);

  if (!preview) return null;

  const statClass = 'flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900';
  const labelClass = 'text-xs text-slate-400';
  const countClass = 'text-lg font-semibold';
  const badgeNew = 'text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
  const badgeExists = 'text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Preview">
      <div className="space-y-4">
        {/* Scope badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
            {preview.scope === 'full' ? 'Full Export' : 'Space Export'}
          </span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className={statClass}>
            <FolderOpen size={16} className="text-blue-400 flex-shrink-0" />
            <div>
              <div className={countClass}>{preview.spaces.total}</div>
              <div className={labelClass}>
                {preview.spaces.new > 0 && <span className="text-green-500">{preview.spaces.new} new</span>}
                {preview.spaces.new > 0 && preview.spaces.existing > 0 && ' · '}
                {preview.spaces.existing > 0 && `${preview.spaces.existing} exist`}
                {preview.spaces.total === 0 && 'spaces'}
              </div>
            </div>
          </div>
          <div className={statClass}>
            <FileText size={16} className="text-purple-400 flex-shrink-0" />
            <div>
              <div className={countClass}>{preview.items.total}</div>
              <div className={labelClass}>
                {preview.items.new > 0 && <span className="text-green-500">{preview.items.new} new</span>}
                {preview.items.new > 0 && preview.items.duplicate > 0 && ' · '}
                {preview.items.duplicate > 0 && `${preview.items.duplicate} dup`}
                {preview.items.total === 0 && 'items'}
              </div>
            </div>
          </div>
          <div className={statClass}>
            <Tag size={16} className="text-amber-400 flex-shrink-0" />
            <div>
              <div className={countClass}>{preview.tags.total}</div>
              <div className={labelClass}>
                {preview.tags.new > 0 && <span className="text-green-500">{preview.tags.new} new</span>}
                {preview.tags.new > 0 && preview.tags.existing > 0 && ' · '}
                {preview.tags.existing > 0 && `${preview.tags.existing} exist`}
                {preview.tags.total === 0 && 'tags'}
              </div>
            </div>
          </div>
        </div>

        {/* Space details */}
        {preview.spaces.details.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Spaces</h4>
            <div className="space-y-1">
              {preview.spaces.details.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900 text-sm">
                  <span>{s.name}</span>
                  <span className={s.status === 'new' ? badgeNew : badgeExists}>
                    {s.status === 'new' ? 'new' : 'exists'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {preview.warnings.length > 0 && (
          <div className="space-y-1">
            {preview.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Settings toggle */}
        {preview.hasSettings && (
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={importSettings}
              onChange={(e) => setImportSettings(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            <span className="text-slate-600 dark:text-slate-300">Import settings</span>
            <span className="text-[10px] text-slate-400">(theme, limits — API key preserved)</span>
          </label>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ importSettings })}
            disabled={isImporting || (preview.items.new === 0 && preview.spaces.new === 0 && preview.tags.new === 0 && !importSettings)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
          >
            {isImporting ? 'Importing...' : 'Confirm Import'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
