import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import matter from 'gray-matter';
import crypto from 'crypto';
import { getDb } from '../../db/database.js';

export interface DeserializeResult {
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  spacesCreated: number;
  focusAreasCreated: number;
  tagsCreated: number;
}

interface ParsedItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  priority: number;
  effort: string | null;
  energy: string | null;
  spaceName: string | null;
  focusAreaName: string | null;
  tagNames: string[];
  horizon: string;
  position: number;
  parentId: string | null;
  url: string | null;
  urlMeta: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function deserializeFromDirectory(userId: string, inputDir: string): DeserializeResult {
  const db = getDb();
  const result: DeserializeResult = {
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsDeleted: 0,
    spacesCreated: 0,
    focusAreasCreated: 0,
    tagsCreated: 0,
  };

  const metaDir = path.join(inputDir, '_meta');

  // Load meta files
  const spaceDefs = loadYaml<Array<{ id: string; name: string; color: string; icon: string; position: number; created_at: string }>>(
    path.join(metaDir, 'spaces.yml')
  ) || [];
  const focusAreaDefs = loadYaml<Array<{ id: string; space: string; name: string; icon: string; position: number; created_at: string }>>(
    path.join(metaDir, 'focus-areas.yml')
  ) || [];
  const tagDefs = loadYaml<Array<{ id: string; name: string; color: string }>>(
    path.join(metaDir, 'tags.yml')
  ) || [];
  const settingsDefs = loadYaml<Record<string, any>>(
    path.join(metaDir, 'settings.yml')
  ) || {};

  // Parse all .md files
  const parsedItems = parseAllItems(inputDir);
  const parsedItemIds = new Set(parsedItems.map(i => i.id));

  const runMerge = db.transaction(() => {
    // 1. Merge settings (non-sensitive only)
    if (Object.keys(settingsDefs).length > 0) {
      const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any;
      const current = user?.settings ? JSON.parse(user.settings) : {};
      const merged = { ...current, ...settingsDefs };
      db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(merged), userId);
    }

    // 2. Resolve spaces
    const spaceNameToId = new Map<string, string>();
    const existingSpaces = db.prepare('SELECT id, name FROM spaces WHERE user_id = ?').all(userId) as any[];
    for (const s of existingSpaces) spaceNameToId.set(s.name.toLowerCase(), s.id);

    let maxSpacePos = (db.prepare('SELECT MAX(position) as max FROM spaces WHERE user_id = ?').get(userId) as any)?.max ?? -1;

    for (const spaceDef of spaceDefs) {
      if (spaceNameToId.has(spaceDef.name.toLowerCase())) continue;
      const existing = db.prepare('SELECT id FROM spaces WHERE id = ?').get(spaceDef.id) as any;
      if (existing) {
        spaceNameToId.set(spaceDef.name.toLowerCase(), spaceDef.id);
        continue;
      }
      const newId = spaceDef.id || crypto.randomUUID();
      db.prepare(
        'INSERT INTO spaces (id, user_id, name, color, icon, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(newId, userId, spaceDef.name, spaceDef.color || '#3b82f6', spaceDef.icon || 'folder', ++maxSpacePos, spaceDef.created_at || new Date().toISOString());
      spaceNameToId.set(spaceDef.name.toLowerCase(), newId);
      result.spacesCreated++;
    }

    // 3. Resolve focus areas
    const focusAreaKey = (spaceName: string, faName: string) => `${spaceName.toLowerCase()}|${faName.toLowerCase()}`;
    const focusAreaKeyToId = new Map<string, string>();
    const existingFocusAreas = db.prepare(`
      SELECT fa.id, fa.name, s.name as space_name FROM focus_areas fa
      JOIN spaces s ON s.id = fa.space_id
      WHERE fa.user_id = ?
    `).all(userId) as any[];
    for (const fa of existingFocusAreas) focusAreaKeyToId.set(focusAreaKey(fa.space_name, fa.name), fa.id);

    for (const faDef of focusAreaDefs) {
      if (!faDef.space) continue;
      const key = focusAreaKey(faDef.space, faDef.name);
      if (focusAreaKeyToId.has(key)) continue;
      const spaceId = spaceNameToId.get(faDef.space.toLowerCase());
      if (!spaceId) continue;
      const existing = db.prepare('SELECT id FROM focus_areas WHERE id = ?').get(faDef.id) as any;
      if (existing) {
        focusAreaKeyToId.set(key, faDef.id);
        continue;
      }
      const newId = faDef.id || crypto.randomUUID();
      const maxPos = (db.prepare('SELECT MAX(position) as max FROM focus_areas WHERE space_id = ?').get(spaceId) as any)?.max ?? -1;
      db.prepare('INSERT INTO focus_areas (id, user_id, space_id, name, icon, position) VALUES (?, ?, ?, ?, ?, ?)').run(
        newId, userId, spaceId, faDef.name, faDef.icon || 'folder', maxPos + 1
      );
      focusAreaKeyToId.set(key, newId);
      result.focusAreasCreated++;
    }

    // 4. Resolve tags
    const tagNameToId = new Map<string, string>();
    const existingTags = db.prepare('SELECT id, name FROM tags WHERE user_id = ?').all(userId) as any[];
    for (const t of existingTags) tagNameToId.set(t.name.toLowerCase(), t.id);

    for (const tagDef of tagDefs) {
      if (tagNameToId.has(tagDef.name.toLowerCase())) continue;
      const existing = db.prepare('SELECT id FROM tags WHERE id = ?').get(tagDef.id) as any;
      if (existing) {
        tagNameToId.set(tagDef.name.toLowerCase(), tagDef.id);
        continue;
      }
      const newId = tagDef.id || crypto.randomUUID();
      db.prepare('INSERT INTO tags (id, user_id, name, color) VALUES (?, ?, ?, ?)').run(
        newId, userId, tagDef.name, tagDef.color || '#6b7280'
      );
      tagNameToId.set(tagDef.name.toLowerCase(), newId);
      result.tagsCreated++;
    }

    // 5. Merge items — last-write-wins on updated_at
    const existingItems = db.prepare('SELECT id, updated_at FROM items WHERE user_id = ?').all(userId) as any[];
    const existingItemMap = new Map<string, string>();
    for (const i of existingItems) existingItemMap.set(i.id, i.updated_at);

    const updateItem = db.prepare(`
      UPDATE items SET space_id = ?, focus_area_id = ?, parent_id = ?, type = ?, title = ?,
        description = ?, url = ?, url_meta = ?, priority = ?, effort = ?, energy = ?,
        horizon = ?, position = ?, due_date = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `);

    const insertItem = db.prepare(`
      INSERT INTO items (id, user_id, space_id, focus_area_id, parent_id, type, title,
        description, url, url_meta, priority, effort, energy, horizon, position,
        due_date, completed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    function resolveItem(parsed: ParsedItem): { spaceId: string | null; focusAreaId: string | null } {
      const spaceId = parsed.spaceName ? (spaceNameToId.get(parsed.spaceName.toLowerCase()) || null) : null;
      let focusAreaId: string | null = null;
      if (parsed.focusAreaName && parsed.spaceName) {
        focusAreaId = focusAreaKeyToId.get(focusAreaKey(parsed.spaceName, parsed.focusAreaName)) || null;
      }
      return { spaceId, focusAreaId };
    }

    function upsertItem(parsed: ParsedItem, parentId: string | null) {
      const { spaceId, focusAreaId } = resolveItem(parsed);
      const existingUpdatedAt = existingItemMap.get(parsed.id);

      if (existingUpdatedAt !== undefined) {
        if (parsed.updatedAt > existingUpdatedAt) {
          updateItem.run(
            spaceId, focusAreaId, parentId, parsed.type, parsed.title,
            parsed.description, parsed.url, parsed.urlMeta,
            parsed.priority, parsed.effort, parsed.energy,
            parsed.horizon, parsed.position, parsed.dueDate,
            parsed.completedAt, parsed.updatedAt, parsed.id
          );
          result.itemsUpdated++;
        }
      } else {
        insertItem.run(
          parsed.id, userId, spaceId, focusAreaId, parentId,
          parsed.type, parsed.title, parsed.description,
          parsed.url, parsed.urlMeta, parsed.priority,
          parsed.effort, parsed.energy, parsed.horizon,
          parsed.position, parsed.dueDate, parsed.completedAt,
          parsed.createdAt, parsed.updatedAt
        );
        result.itemsCreated++;
      }
    }

    // Two-pass: parents first, then children
    const parents = parsedItems.filter(i => !i.parentId);
    const children = parsedItems.filter(i => i.parentId);

    for (const item of parents) upsertItem(item, null);
    for (const item of children) upsertItem(item, item.parentId);

    // 6. Sync item-tags
    const deleteItemTags = db.prepare('DELETE FROM item_tags WHERE item_id = ?');
    const insertItemTag = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)');

    for (const parsed of parsedItems) {
      if (!existingItemMap.has(parsed.id) || parsed.updatedAt > (existingItemMap.get(parsed.id) || '')) {
        deleteItemTags.run(parsed.id);
        for (const tagName of parsed.tagNames) {
          const tagId = tagNameToId.get(tagName.toLowerCase());
          if (tagId) insertItemTag.run(parsed.id, tagId);
        }
      }
    }

    // 7. Delete items that exist in SQLite but not in markdown
    const deleteItem = db.prepare('DELETE FROM items WHERE id = ?');
    for (const [existingId] of existingItemMap) {
      if (!parsedItemIds.has(existingId)) {
        deleteItem.run(existingId);
        result.itemsDeleted++;
      }
    }
  });

  runMerge();
  return result;
}

function loadYaml<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content) as T;
}

function parseAllItems(inputDir: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const entries = fs.readdirSync(inputDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '_meta' || entry.name === '.git') continue;

    const spaceDir = path.join(inputDir, entry.name);
    const horizonDirs = fs.readdirSync(spaceDir, { withFileTypes: true });

    for (const hEntry of horizonDirs) {
      if (!hEntry.isDirectory()) continue;
      const horizon = hEntry.name;
      const horizonDir = path.join(spaceDir, horizon);
      const files = fs.readdirSync(horizonDir).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(horizonDir, file);
        const parsed = parseItemFile(filePath, horizon);
        if (parsed) items.push(parsed);
      }
    }
  }

  return items;
}

function parseItemFile(filePath: string, horizon: string): ParsedItem | null {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  if (!data.id) return null;

  const lines = content.trim().split('\n');
  let title = data.title || '';
  let description: string | null = null;

  if (lines.length > 0 && lines[0].startsWith('# ')) {
    title = lines[0].slice(2).trim();
    const rest = lines.slice(1).join('\n').trim();
    description = rest || null;
  } else if (lines.length > 0 && !title) {
    title = lines[0].trim();
    const rest = lines.slice(1).join('\n').trim();
    description = rest || null;
  }

  let urlMeta: string | null = null;
  if (data.url_meta && typeof data.url_meta === 'object') {
    urlMeta = JSON.stringify(data.url_meta);
  }

  return {
    id: data.id,
    type: data.type || 'task',
    title,
    description,
    priority: data.priority ?? 0,
    effort: data.effort || null,
    energy: data.energy || null,
    spaceName: data.space || null,
    focusAreaName: data.focus_area || null,
    tagNames: Array.isArray(data.tags) ? data.tags : [],
    horizon,
    position: data.position ?? 0,
    parentId: data.parent_id || null,
    url: data.url || null,
    urlMeta,
    dueDate: data.due_date || null,
    completedAt: data.completed_at || null,
    createdAt: data.created_at || new Date().toISOString(),
    updatedAt: data.updated_at || new Date().toISOString(),
  };
}
