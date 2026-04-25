export type Horizon = 'backlog' | 'later' | 'soon' | 'now' | 'done';
export type View = 'dashboard' | 'kanban' | 'funnel' | 'calendar' | 'grid' | 'log';
export type ItemType = 'task' | 'note' | 'link' | 'project';
export type Priority = 0 | 1 | 2 | 3 | 4;
export type Effort = 'S' | 'M' | 'L' | 'XL';
export type Energy = 'deep_focus' | 'light' | 'routine';

export interface Space {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
  created_at: string;
}

export interface FocusArea {
  id: string;
  user_id: string;
  space_id: string;
  name: string;
  icon: string;
  position: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id?: string;
  name: string;
  color: string;
}

export interface UrlMeta {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export interface Item {
  id: string;
  user_id: string;
  space_id: string | null;
  focus_area_id: string | null;
  parent_id: string | null;
  type: ItemType;
  title: string;
  description: string | null;
  url: string | null;
  url_meta: string | null;
  priority: Priority;
  effort: Effort | null;
  energy: Energy | null;
  horizon: Horizon;
  position: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface HorizonLimits {
  later: number;
  soon: number;
  now: number;
}

export type AiProvider = 'anthropic' | 'vertex';

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  aiProvider?: AiProvider;
  anthropicApiKey?: string;
  anthropicModel?: string;
  vertexProjectId?: string;
  vertexRegion?: string;
  inFocusLimit: number;
  autoArchiveDays: number;
  horizonLimits?: HorizonLimits;
}

export interface CreateItemInput {
  title: string;
  space_id?: string | null;
  focus_area_id?: string | null;
  parent_id?: string | null;
  type?: ItemType;
  description?: string;
  url?: string;
  url_meta?: UrlMeta;
  priority?: Priority;
  effort?: Effort;
  energy?: Energy;
  horizon?: Horizon;
  due_date?: string;
}

export interface UpdateItemInput extends Partial<CreateItemInput> {
  id: string;
}

export interface ImportPreview {
  scope: 'full' | 'space';
  spaces: { total: number; new: number; existing: number; details: Array<{ name: string; status: 'new' | 'exists' }> };
  items: { total: number; new: number; duplicate: number };
  tags: { total: number; new: number; existing: number };
  hasSettings: boolean;
  warnings: string[];
}

export interface ImportResult {
  success: boolean;
  imported: { spaces: number; items: number; tags: number };
}

export interface ActivityEntry {
  id: string;
  user_id: string;
  entity_type: 'item' | 'space' | 'focus_area';
  entity_id: string;
  entity_title: string;
  action: 'created' | 'updated' | 'deleted' | 'moved';
  changes: Record<string, { from: unknown; to: unknown }> | null;
  snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityResponse {
  entries: ActivityEntry[];
  total: number;
}

export interface ReviewMetrics {
  completed: number;
  completedByType: { type: string; count: number }[];
  completedByEnergy: { energy: string; count: number }[];
  horizonDistribution: { horizon: string; count: number }[];
  activeItems: number;
  rolledOver: number;
  dailyVelocity: { day: string; count: number }[];
}

export interface ReviewSnapshot {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  snapshot_type: string;
  metrics: ReviewMetrics;
  created_at: string;
}

export interface GitSyncStatus {
  enabled: boolean;
  configured: boolean;
  repoUrl: string | null;
  branch: string;
  syncInterval: number;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'error' | null;
  lastError: string | null;
  isSyncing: boolean;
  schedulerRunning: boolean;
  nextSyncAt: string | null;
}

export interface SyncLogEntry {
  id: string;
  direction: 'push' | 'pull' | 'full';
  status: 'success' | 'error';
  items_created: number;
  items_updated: number;
  items_deleted: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface GitSyncConfig {
  repoUrl: string;
  branch?: string;
  authToken: string;
  syncInterval?: number;
}
