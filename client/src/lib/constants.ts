import type { Horizon } from '../types';

export interface HorizonConfig {
  id: Horizon;
  label: string;
  icon: string;
  description: string;
  colorClass: string;
  accentColor: string;
}

export const HORIZONS: HorizonConfig[] = [
  {
    id: 'backlog',
    label: 'Backlog',
    icon: 'Archive',
    description: 'Everything captured, no time pressure',
    colorClass: 'slate',
    accentColor: '#64748b',
  },
  {
    id: 'later',
    label: 'Later',
    icon: 'CalendarClock',
    description: 'On the radar, months out',
    colorClass: 'purple',
    accentColor: '#8b5cf6',
  },
  {
    id: 'soon',
    label: 'Soon',
    icon: 'Timer',
    description: 'Weeks out, getting closer',
    colorClass: 'amber',
    accentColor: '#f59e0b',
  },
  {
    id: 'now',
    label: 'Now',
    icon: 'Zap',
    description: 'This week — committed',
    colorClass: 'blue',
    accentColor: '#3b82f6',
  },
  {
    id: 'done',
    label: 'Done',
    icon: 'CheckCircle2',
    description: 'Completed',
    colorClass: 'emerald',
    accentColor: '#10b981',
  },
];

export const ENERGIES = [
  { value: 'deep_focus' as const, label: 'Deep Focus', icon: 'Brain', color: 'bg-red-500/20 text-red-400' },
  { value: 'light' as const, label: 'Light', icon: 'Sun', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'routine' as const, label: 'Routine', icon: 'RotateCw', color: 'bg-green-500/20 text-green-400' },
];

export const PRIORITIES = [
  { value: 0 as const, label: 'None', color: '' },
  { value: 1 as const, label: 'P1', color: 'bg-red-500/20 text-red-400' },
  { value: 2 as const, label: 'P2', color: 'bg-orange-500/20 text-orange-400' },
  { value: 3 as const, label: 'P3', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 4 as const, label: 'P4', color: 'bg-slate-500/20 text-slate-400' },
];

export const EFFORTS = [
  { value: 'S' as const, label: 'S', color: 'bg-green-500/20 text-green-400' },
  { value: 'M' as const, label: 'M', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'L' as const, label: 'L', color: 'bg-orange-500/20 text-orange-400' },
  { value: 'XL' as const, label: 'XL', color: 'bg-red-500/20 text-red-400' },
];

export const ITEM_TYPES = [
  { value: 'task' as const, label: 'Task', icon: 'CheckSquare' },
  { value: 'note' as const, label: 'Note', icon: 'StickyNote' },
  { value: 'link' as const, label: 'Link', icon: 'Link' },
  { value: 'project' as const, label: 'Project', icon: 'FolderKanban' },
];

export const DEFAULT_HORIZON_LIMITS: Record<string, number> = {
  later: 15,
  soon: 8,
  now: 5,
};

export const SPACE_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
];
