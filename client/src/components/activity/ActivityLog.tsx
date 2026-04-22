import { useState } from 'react';
import { History, RotateCcw, Plus, Pencil, Trash2, ArrowRight, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { useActivity, useRevertActivity } from '../../hooks/useActivity';
import { HORIZONS } from '../../lib/constants';
import type { ActivityEntry } from '../../types';

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  created: { icon: <Plus size={14} />, color: 'text-emerald-500 bg-emerald-500/10', label: 'Created' },
  updated: { icon: <Pencil size={14} />, color: 'text-blue-500 bg-blue-500/10', label: 'Updated' },
  deleted: { icon: <Trash2 size={14} />, color: 'text-red-500 bg-red-500/10', label: 'Deleted' },
  moved: { icon: <ArrowRight size={14} />, color: 'text-purple-500 bg-purple-500/10', label: 'Moved' },
};

const ENTITY_LABELS: Record<string, string> = {
  item: 'Item',
  space: 'Space',
  focus_area: 'Focus Area',
};

const PAGE_SIZE = 50;

export function ActivityLog() {
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useActivity({
    entity_type: entityFilter || undefined,
    action: actionFilter || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const revert = useRevertActivity();

  const entries = data?.entries || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRevert = (entry: ActivityEntry) => {
    revert.mutate(entry.id, {
      onSuccess: () => toast.success(`Reverted: ${entry.entity_title}`),
      onError: () => toast.error('Failed to revert'),
    });
  };

  const groupByDate = (entries: ActivityEntry[]) => {
    const groups: { date: string; entries: ActivityEntry[] }[] = [];
    let currentDate = '';

    for (const entry of entries) {
      const date = entry.created_at.split('T')[0] ?? '';
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date: currentDate, entries: [] });
      }
      const lastGroup = groups[groups.length - 1];
      if (lastGroup) lastGroup.entries.push(entry);
    }

    return groups;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const groups = groupByDate(entries);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <History size={20} className="text-slate-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Activity Log</h2>
              <p className="text-xs text-slate-400">{total} total entries</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter size={14} className="text-slate-400" />
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500"
          >
            <option value="">All types</option>
            <option value="item">Items</option>
            <option value="space">Spaces</option>
            <option value="focus_area">Focus Areas</option>
          </select>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500"
          >
            <option value="">All actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="moved">Moved</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>

        {/* Timeline */}
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <History size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No activity yet. Changes will appear here as you work.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {formatDate(group.date)}
                  </span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                  <span className="text-[10px] text-slate-400">{group.entries.length} changes</span>
                </div>

                <div className="space-y-1">
                  {group.entries.map((entry) => {
                    const config = (ACTION_CONFIG[entry.action] || ACTION_CONFIG.updated)!;
                    const isExpanded = expandedIds.has(entry.id);

                    return (
                      <div
                        key={entry.id}
                        className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
                      >
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          onClick={() => toggleExpand(entry.id)}
                        >
                          <div className={clsx('p-1.5 rounded-md', config.color)}>
                            {config.icon}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{entry.entity_title}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 flex-shrink-0">
                                {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={clsx('text-xs font-medium', config.color.split(' ')[0])}>
                                {config.label}
                              </span>
                              {entry.action === 'moved' && entry.changes?.horizon && (
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <HorizonBadge id={String(entry.changes.horizon.from)} />
                                  <ArrowRight size={10} />
                                  <HorizonBadge id={String(entry.changes.horizon.to)} />
                                </span>
                              )}
                              {entry.action === 'updated' && entry.changes && !entry.changes._revert && (
                                <span className="text-xs text-slate-400">
                                  {Object.keys(entry.changes).length} field{Object.keys(entry.changes).length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {entry.changes?._revert && (
                                <span className="text-xs text-amber-500 font-medium">Revert</span>
                              )}
                            </div>
                          </div>

                          <span className="text-[10px] text-slate-400 flex-shrink-0">
                            {formatTime(entry.created_at)}
                          </span>

                          {isExpanded
                            ? <ChevronDown size={14} className="text-slate-400" />
                            : <ChevronRight size={14} className="text-slate-400" />}
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                            {entry.changes && !entry.changes._revert && (
                              <div className="space-y-1.5 mb-3">
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Changes</span>
                                {Object.entries(entry.changes).map(([key, val]) => (
                                  <div key={key} className="flex items-center gap-2 text-xs">
                                    <span className="text-slate-500 font-medium w-24 flex-shrink-0">{formatFieldName(key)}</span>
                                    <span className="text-red-400 line-through truncate max-w-[200px]">
                                      {formatValue(key, val.from)}
                                    </span>
                                    <ArrowRight size={10} className="text-slate-300 flex-shrink-0" />
                                    <span className="text-emerald-500 truncate max-w-[200px]">
                                      {formatValue(key, val.to)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRevert(entry); }}
                                disabled={revert.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                              >
                                <RotateCcw size={12} />
                                {entry.action === 'deleted' ? 'Restore' : 'Revert'}
                              </button>
                              <span className="text-[10px] text-slate-400">
                                ID: {entry.entity_id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HorizonBadge({ id }: { id: string }) {
  const horizon = HORIZONS.find((h) => h.id === id);
  if (!horizon) return <span className="text-xs text-slate-400">{id}</span>;
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{ backgroundColor: horizon.accentColor + '25', color: horizon.accentColor }}
    >
      {horizon.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().slice(0, 10)) return 'Today';
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatFieldName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return 'none';
  if (key === 'priority') {
    const labels = ['None', 'P1', 'P2', 'P3', 'P4'];
    return labels[Number(value)] || String(value);
  }
  if (key === 'horizon') {
    const h = HORIZONS.find((h) => h.id === value);
    return h?.label || String(value);
  }
  return String(value);
}
