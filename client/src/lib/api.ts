import type { Space, FocusArea, Item, Tag, UserSettings, CreateItemInput, UpdateItemInput, UrlMeta, ImportPreview, ImportResult, ReviewSnapshot, ActivityResponse } from '../types';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Spaces
export const getSpaces = () => apiFetch<Space[]>('/spaces');
export const createSpace = (data: { name: string; color?: string; icon?: string }) =>
  apiFetch<Space>('/spaces', { method: 'POST', body: JSON.stringify(data) });
export const updateSpace = (id: string, data: Partial<Space>) =>
  apiFetch<Space>(`/spaces/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSpace = (id: string, moveItemsTo?: string) =>
  apiFetch<void>(`/spaces/${id}${moveItemsTo ? `?moveItemsTo=${moveItemsTo}` : ''}`, { method: 'DELETE' });
export const reorderSpaces = (ids: string[]) =>
  apiFetch<{ ok: boolean }>('/spaces/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) });

// Focus Areas
export const getFocusAreas = (spaceId?: string) => {
  const params = spaceId ? `?space_id=${spaceId}` : '';
  return apiFetch<FocusArea[]>(`/focus-areas${params}`);
};
export const createFocusArea = (data: { name: string; space_id: string; icon?: string }) =>
  apiFetch<FocusArea>('/focus-areas', { method: 'POST', body: JSON.stringify(data) });
export const updateFocusArea = (id: string, data: Partial<FocusArea>) =>
  apiFetch<FocusArea>(`/focus-areas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteFocusArea = (id: string) =>
  apiFetch<void>(`/focus-areas/${id}`, { method: 'DELETE' });
export const reorderFocusAreas = (ids: string[]) =>
  apiFetch<{ ok: boolean }>('/focus-areas/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) });

// Items
export const getItems = (filters?: { space_id?: string; focus_area_id?: string; horizon?: string; type?: string; energy?: string; search?: string; parent_id?: string }) => {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }
  const query = params.toString();
  return apiFetch<Item[]>(`/items${query ? `?${query}` : ''}`);
};
export const getItem = (id: string) => apiFetch<Item>(`/items/${id}`);
export const getItemChildren = (id: string) => apiFetch<Item[]>(`/items/${id}/children`);
export const createItem = (data: CreateItemInput) =>
  apiFetch<Item>('/items', { method: 'POST', body: JSON.stringify(data) });
export const updateItem = ({ id, ...data }: UpdateItemInput) =>
  apiFetch<Item>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteItem = (id: string) =>
  apiFetch<void>(`/items/${id}`, { method: 'DELETE' });
export const moveItemToHorizon = (id: string, horizon: string, position?: number) =>
  apiFetch<Item>(`/items/${id}/horizon`, { method: 'PATCH', body: JSON.stringify({ horizon, position }) });
export const reorderItems = (ids: string[]) =>
  apiFetch<{ ok: boolean }>('/items/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) });
export const fetchUrlMeta = (url: string) =>
  apiFetch<UrlMeta>('/items/url-meta', { method: 'POST', body: JSON.stringify({ url }) });

// Tags
export const getTags = () => apiFetch<Tag[]>('/tags');
export const createTag = (data: { name: string; color?: string }) =>
  apiFetch<Tag>('/tags', { method: 'POST', body: JSON.stringify(data) });
export const updateTag = (id: string, data: Partial<Tag>) =>
  apiFetch<Tag>(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTag = (id: string) =>
  apiFetch<void>(`/tags/${id}`, { method: 'DELETE' });
export const getItemTags = (itemId: string) =>
  apiFetch<Tag[]>(`/tags/item/${itemId}`);
export const addTagToItem = (itemId: string, tagId: string) =>
  apiFetch<{ ok: boolean }>(`/tags/item/${itemId}`, { method: 'POST', body: JSON.stringify({ tag_id: tagId }) });
export const removeTagFromItem = (itemId: string, tagId: string) =>
  apiFetch<void>(`/tags/item/${itemId}/${tagId}`, { method: 'DELETE' });

// Stats
export const getStats = (spaceId?: string) => {
  const params = spaceId ? `?space_id=${spaceId}` : '';
  return apiFetch<any>(`/stats${params}`);
};

// Activity
export const getActivity = (filters?: { entity_type?: string; action?: string; limit?: number; offset?: number }) => {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.set(key, String(value));
    });
  }
  const query = params.toString();
  return apiFetch<ActivityResponse>(`/activity${query ? `?${query}` : ''}`);
};
export const revertActivity = (id: string) =>
  apiFetch<{ success: boolean; entity: any }>(`/activity/${id}/revert`, { method: 'POST' });

// Reviews
export const getReviews = (limit = 10) => apiFetch<ReviewSnapshot[]>(`/reviews?limit=${limit}`);
export const getCurrentReview = () => apiFetch<ReviewSnapshot>('/reviews/current');
export const generateReview = (periodStart?: string, periodEnd?: string) =>
  apiFetch<any>('/reviews/generate', { method: 'POST', body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }) });

// Settings
export const getSettings = () => apiFetch<UserSettings>('/settings');
export const updateSettings = (data: Partial<UserSettings>) =>
  apiFetch<UserSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) });

// Export / Backup
export async function downloadExportJson() {
  const res = await fetch('/api/export/json');
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sift-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadDbBackup() {
  const res = await fetch('/api/export/db');
  if (!res.ok) throw new Error('Backup failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sift-backup-${new Date().toISOString().slice(0, 10)}.db`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadSpaceExportJson(spaceId: string, spaceName: string) {
  const res = await fetch(`/api/export/json/${spaceId}`);
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = spaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.href = url;
  a.download = `sift-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import
export const previewImport = (data: any) =>
  apiFetch<ImportPreview>('/import/preview', { method: 'POST', body: JSON.stringify(data) });

export const executeImport = (data: any, options: { importSettings: boolean }) =>
  apiFetch<ImportResult>('/import/execute', { method: 'POST', body: JSON.stringify({ data, options }) });

export async function restoreDatabase(file: File): Promise<{ success: boolean; backupPath: string }> {
  const buffer = await file.arrayBuffer();
  const res = await fetch('/api/import/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Restore failed' }));
    throw new Error(body.error);
  }
  return res.json();
}
