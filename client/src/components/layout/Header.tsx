import { Plus, Settings, LayoutDashboard, Columns3, Calendar, Table2, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { ThemeToggle } from '../ui/ThemeToggle';
import { FunnelIcon } from '../ui/FunnelIcon';
import { SpaceTabs } from './SpaceTabs';
import type { View } from '../../types';

interface HeaderProps {
  onQuickCapture: () => void;
  onAddSpace: () => void;
  onSettings: () => void;
  view: View;
  onViewChange: (view: View) => void;
}

const VIEW_BUTTONS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={14} /> },
  { id: 'kanban', label: 'Kanban', icon: <Columns3 size={14} /> },
  { id: 'funnel', label: 'Funnel', icon: <Filter size={14} /> },
  { id: 'calendar', label: 'Calendar', icon: <Calendar size={14} /> },
  { id: 'grid', label: 'Grid', icon: <Table2 size={14} /> },
];

export function Header({ onQuickCapture, onAddSpace, onSettings, view, onViewChange }: HeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <FunnelIcon size={22} className="text-blue-500 flex-shrink-0" />
      <div className="flex flex-col flex-shrink-0 mr-1">
        <h1 className="text-lg font-bold tracking-tight leading-none">Sift</h1>
        <span className="text-[10px] text-slate-400 leading-tight hidden lg:block">Capture everything. Focus on what matters.</span>
      </div>

      {/* View toggle */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 flex-shrink-0">
        {VIEW_BUTTONS.map((v) => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              view === v.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            )}
          >
            {v.icon}
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        ))}
      </div>

      {/* Space selector — visible on all views except dashboard */}
      {view !== 'dashboard' && (
        <div className="flex-shrink-0">
          <SpaceTabs onAddSpace={onAddSpace} />
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onQuickCapture}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
          title="Quick capture (Cmd+K)"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Capture</span>
          <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 ml-1 rounded bg-blue-600 text-[10px] font-mono">
            {'\u2318'}K
          </kbd>
        </button>
        <ThemeToggle />
        <button
          onClick={onSettings}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
