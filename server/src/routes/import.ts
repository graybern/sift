import { Router } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { getDb, closeDb, resetDb } from '../db/database.js';

const router = Router();

interface ImportData {
  version?: number;
  scope?: 'full' | 'space';
  settings?: Record<string, any>;
  space?: any;
  spaces?: any[];
  focusAreas?: any[];
  items?: any[];
  tags?: any[];
  itemTags?: any[];
}

function detectScope(data: ImportData): 'full' | 'space' {
  if (data.scope) return data.scope;
  // Backward compat: exports before scope field was added are full exports
  if (data.spaces) return 'full';
  if (data.space) return 'space';
  return 'full';
}

function normalizeSpaces(data: ImportData): any[] {
  const scope = detectScope(data);
  if (scope === 'space' && data.space) return [data.space];
  return data.spaces || [];
}

// Analyze import data and return a preview without writing anything
router.post('/preview', (req, res) => {
  const userId = (req as any).userId;
  const data: ImportData = req.body;

  if (!data || (!data.spaces && !data.space && !data.items)) {
    res.status(400).json({ error: 'Invalid import file: missing spaces or items' });
    return;
  }

  const db = getDb();
  const scope = detectScope(data);
  const importSpaces = normalizeSpaces(data);
  const importItems = data.items || [];
  const importTags = data.tags || [];
  const warnings: string[] = [];

  // Analyze spaces
  const existingSpaces = db.prepare('SELECT id, name FROM spaces WHERE user_id = ?').all(userId) as any[];
  const existingSpaceNames = new Set(existingSpaces.map((s: any) => s.name.toLowerCase()));
  const existingSpaceIds = new Set(existingSpaces.map((s: any) => s.id));

  let newSpaces = 0;
  let existingSpaceCount = 0;
  const spaceDetails: Array<{ name: string; status: 'new' | 'exists' }> = [];

  for (const space of importSpaces) {
    if (existingSpaceIds.has(space.id) || existingSpaceNames.has(space.name.toLowerCase())) {
      existingSpaceCount++;
      spaceDetails.push({ name: space.name, status: 'exists' });
    } else {
      newSpaces++;
      spaceDetails.push({ name: space.name, status: 'new' });
    }
  }

  // Analyze items
  const existingItems = db.prepare('SELECT id, title, type, horizon, space_id FROM items WHERE user_id = ?').all(userId) as any[];
  const existingItemIds = new Set(existingItems.map((i: any) => i.id));
  const existingItemFingerprints = new Set(
    existingItems.map((i: any) => `${i.title}|${i.type}|${i.horizon}|${i.space_id || ''}`)
  );

  // Build space name→id map for fingerprint matching
  const spaceIdToName: Record<string, string> = {};
  for (const s of existingSpaces) spaceIdToName[s.id] = s.name.toLowerCase();
  for (const s of importSpaces) spaceIdToName[s.id] = s.name.toLowerCase();

  let newItems = 0;
  let duplicateItems = 0;

  for (const item of importItems) {
    if (existingItemIds.has(item.id)) {
      duplicateItems++;
    } else {
      // Resolve the space_id to match against existing items
      let resolvedSpaceId = item.space_id;
      if (resolvedSpaceId) {
        const spaceName = spaceIdToName[resolvedSpaceId];
        if (spaceName) {
          const existingSpace = existingSpaces.find((s: any) => s.name.toLowerCase() === spaceName);
          if (existingSpace) resolvedSpaceId = existingSpace.id;
        }
      }
      const stageMap: Record<string, string> = { inbox: 'backlog', someday: 'backlog', up_next: 'later', in_focus: 'now', done: 'done' };
      const resolvedHorizon = item.horizon || (item.stage ? stageMap[item.stage] || 'backlog' : 'backlog');
      const fingerprint = `${item.title}|${item.type}|${resolvedHorizon}|${resolvedSpaceId || ''}`;
      if (existingItemFingerprints.has(fingerprint)) {
        duplicateItems++;
      } else {
        newItems++;
      }
    }
  }

  // Analyze tags
  const existingTags = db.prepare('SELECT id, name FROM tags WHERE user_id = ?').all(userId) as any[];
  const existingTagNames = new Set(existingTags.map((t: any) => t.name.toLowerCase()));
  const existingTagIds = new Set(existingTags.map((t: any) => t.id));

  let newTags = 0;
  let existingTagCount = 0;
  for (const tag of importTags) {
    if (existingTagIds.has(tag.id) || existingTagNames.has(tag.name.toLowerCase())) {
      existingTagCount++;
    } else {
      newTags++;
    }
  }

  // Check for orphaned space references
  const importSpaceIds = new Set(importSpaces.map((s: any) => s.id));
  const itemsWithMissingSpaces = importItems.filter(
    (i: any) => i.space_id && !importSpaceIds.has(i.space_id) && !existingSpaceIds.has(i.space_id)
  );
  if (itemsWithMissingSpaces.length > 0) {
    warnings.push(`${itemsWithMissingSpaces.length} item(s) reference spaces not in this export — they will be unassigned`);
  }

  // Check for circular parent references
  const parentMap = new Map<string, string>();
  for (const item of importItems) {
    if (item.parent_id) parentMap.set(item.id, item.parent_id);
  }
  for (const [id, parentId] of parentMap) {
    let current = parentId;
    const visited = new Set([id]);
    while (current && parentMap.has(current)) {
      if (visited.has(current)) {
        warnings.push('Circular parent references detected in import data — affected sub-tasks will be imported without parents');
        break;
      }
      visited.add(current);
      current = parentMap.get(current)!;
    }
  }

  res.json({
    scope,
    spaces: { total: importSpaces.length, new: newSpaces, existing: existingSpaceCount, details: spaceDetails },
    items: { total: importItems.length, new: newItems, duplicate: duplicateItems },
    tags: { total: importTags.length, new: newTags, existing: existingTagCount },
    hasSettings: scope === 'full' && !!data.settings && Object.keys(data.settings).length > 0,
    warnings: [...new Set(warnings)],
  });
});

// Execute the import
router.post('/execute', (req, res) => {
  const userId = (req as any).userId;
  const { data, options } = req.body as { data: ImportData; options: { importSettings: boolean } };

  if (!data || (!data.spaces && !data.space && !data.items)) {
    res.status(400).json({ error: 'Invalid import data' });
    return;
  }

  const db = getDb();
  const scope = detectScope(data);
  const importSpaces = normalizeSpaces(data);
  const importItems = data.items || [];
  const importTags = data.tags || [];
  const importItemTags = data.itemTags || [];

  const result = { spaces: 0, items: 0, tags: 0 };

  const runImport = db.transaction(() => {
    // 1. Settings (opt-in, full scope only)
    if (options.importSettings && scope === 'full' && data.settings) {
      const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any;
      const current = user?.settings ? JSON.parse(user.settings) : {};
      // Don't overwrite API key unless the import explicitly has one
      const merged = { ...current, ...data.settings };
      if (!data.settings.anthropicApiKey) {
        merged.anthropicApiKey = current.anthropicApiKey;
      }
      db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(merged), userId);
    }

    // 2. Spaces — map imported IDs to existing or new IDs
    const spaceIdMap = new Map<string, string>();
    const existingSpaces = db.prepare('SELECT id, name FROM spaces WHERE user_id = ?').all(userId) as any[];
    const maxPosition = (db.prepare('SELECT MAX(position) as max FROM spaces WHERE user_id = ?').get(userId) as any)?.max ?? -1;
    let nextPosition = maxPosition + 1;

    for (const space of importSpaces) {
      // Check by ID first, then by name
      const byId = existingSpaces.find((s: any) => s.id === space.id);
      if (byId) {
        spaceIdMap.set(space.id, byId.id);
        continue;
      }
      const byName = existingSpaces.find((s: any) => s.name.toLowerCase() === space.name.toLowerCase());
      if (byName) {
        spaceIdMap.set(space.id, byName.id);
        continue;
      }
      // Create new space
      const newId = crypto.randomUUID();
      db.prepare(
        'INSERT INTO spaces (id, user_id, name, color, icon, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(newId, userId, space.name, space.color || '#3b82f6', space.icon || 'folder', nextPosition++, space.created_at || new Date().toISOString());
      spaceIdMap.set(space.id, newId);
      result.spaces++;
    }

    // 2b. Focus Areas — map imported IDs to existing or new IDs
    const focusAreaIdMap = new Map<string, string>();
    const importFocusAreas = data.focusAreas || [];
    if (importFocusAreas.length > 0) {
      const existingFocusAreas = db.prepare('SELECT id, name, space_id FROM focus_areas WHERE user_id = ?').all(userId) as any[];

      for (const fa of importFocusAreas) {
        const resolvedSpaceId = spaceIdMap.get(fa.space_id) || fa.space_id;
        const byId = existingFocusAreas.find((e: any) => e.id === fa.id);
        if (byId) {
          focusAreaIdMap.set(fa.id, byId.id);
          continue;
        }
        const byName = existingFocusAreas.find((e: any) => e.name.toLowerCase() === fa.name.toLowerCase() && e.space_id === resolvedSpaceId);
        if (byName) {
          focusAreaIdMap.set(fa.id, byName.id);
          continue;
        }
        const newId = crypto.randomUUID();
        const maxPos = (db.prepare('SELECT MAX(position) as max FROM focus_areas WHERE space_id = ?').get(resolvedSpaceId) as any)?.max ?? -1;
        db.prepare('INSERT INTO focus_areas (id, user_id, space_id, name, icon, position) VALUES (?, ?, ?, ?, ?, ?)').run(
          newId, userId, resolvedSpaceId, fa.name, fa.icon || 'folder', maxPos + 1
        );
        focusAreaIdMap.set(fa.id, newId);
      }
    }

    // 3. Tags — map imported IDs to existing or new IDs
    const tagIdMap = new Map<string, string>();
    const existingTags = db.prepare('SELECT id, name FROM tags WHERE user_id = ?').all(userId) as any[];

    for (const tag of importTags) {
      const byId = existingTags.find((t: any) => t.id === tag.id);
      if (byId) {
        tagIdMap.set(tag.id, byId.id);
        continue;
      }
      const byName = existingTags.find((t: any) => t.name.toLowerCase() === tag.name.toLowerCase());
      if (byName) {
        tagIdMap.set(tag.id, byName.id);
        continue;
      }
      const newId = crypto.randomUUID();
      db.prepare('INSERT INTO tags (id, user_id, name, color) VALUES (?, ?, ?, ?)').run(
        newId, userId, tag.name, tag.color || '#6b7280'
      );
      tagIdMap.set(tag.id, newId);
      result.tags++;
    }

    // 4. Items — two passes: parents first, then children
    const itemIdMap = new Map<string, string>();
    const existingItems = db.prepare('SELECT id, title, type, horizon, space_id FROM items WHERE user_id = ?').all(userId) as any[];
    const existingItemIds = new Set(existingItems.map((i: any) => i.id));
    const existingItemFingerprints = new Map<string, string>();
    for (const i of existingItems) {
      existingItemFingerprints.set(`${i.title}|${i.type}|${i.horizon}|${i.space_id || ''}`, i.id);
    }

    const stageToHorizon: Record<string, string> = { inbox: 'backlog', someday: 'backlog', up_next: 'later', in_focus: 'now', done: 'done' };

    const insertItem = db.prepare(`
      INSERT INTO items (id, user_id, space_id, parent_id, focus_area_id, type, title, description, url, url_meta, priority, effort, energy, horizon, position, due_date, completed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    function isDuplicate(item: any, resolvedSpaceId: string | null): string | null {
      if (existingItemIds.has(item.id)) {
        return item.id;
      }
      const itemHorizon = item.horizon || stageToHorizon[item.stage] || 'backlog';
      const fingerprint = `${item.title}|${item.type}|${itemHorizon}|${resolvedSpaceId || ''}`;
      return existingItemFingerprints.get(fingerprint) || null;
    }

    function importItem(item: any, parentId: string | null) {
      const resolvedSpaceId = item.space_id ? (spaceIdMap.get(item.space_id) || null) : null;
      const resolvedFocusAreaId = item.focus_area_id ? (focusAreaIdMap.get(item.focus_area_id) || null) : null;
      const existingId = isDuplicate(item, resolvedSpaceId);

      if (existingId) {
        itemIdMap.set(item.id, existingId);
        return;
      }

      const newId = crypto.randomUUID();
      itemIdMap.set(item.id, newId);
      insertItem.run(
        newId, userId, resolvedSpaceId, parentId, resolvedFocusAreaId,
        item.type || 'task', item.title, item.description || null,
        item.url || null, item.url_meta || null,
        item.priority ?? 0, item.effort || null, item.energy || null,
        item.horizon || stageToHorizon[item.stage] || 'backlog', item.position ?? 0,
        item.due_date || null, item.completed_at || null,
        item.created_at || new Date().toISOString(),
        item.updated_at || new Date().toISOString()
      );
      result.items++;
    }

    // Pass 1: items without parent_id
    for (const item of importItems) {
      if (!item.parent_id) {
        importItem(item, null);
      }
    }

    // Pass 2: items with parent_id
    for (const item of importItems) {
      if (item.parent_id) {
        const resolvedParentId = itemIdMap.get(item.parent_id) || null;
        importItem(item, resolvedParentId);
      }
    }

    // 5. Item-tags
    const existingItemTags = new Set<string>();
    if (importItemTags.length > 0) {
      const allMappedItemIds = [...itemIdMap.values()];
      if (allMappedItemIds.length > 0) {
        const placeholders = allMappedItemIds.map(() => '?').join(',');
        const rows = db.prepare(`SELECT item_id, tag_id FROM item_tags WHERE item_id IN (${placeholders})`).all(...allMappedItemIds) as any[];
        for (const row of rows) {
          existingItemTags.add(`${row.item_id}|${row.tag_id}`);
        }
      }
    }

    const insertItemTag = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)');
    for (const it of importItemTags) {
      const mappedItemId = itemIdMap.get(it.item_id);
      const mappedTagId = tagIdMap.get(it.tag_id);
      if (mappedItemId && mappedTagId) {
        const key = `${mappedItemId}|${mappedTagId}`;
        if (!existingItemTags.has(key)) {
          insertItemTag.run(mappedItemId, mappedTagId);
        }
      }
    }
  });

  try {
    runImport();
    res.json({ success: true, imported: result });
  } catch (err: any) {
    res.status(500).json({ error: `Import failed: ${err.message}` });
  }
});

// Restore database from uploaded .db file
router.post('/db', (req, res) => {
  // Read raw body as buffer
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);

    // Check SQLite magic header
    const SQLITE_MAGIC = 'SQLite format 3\0';
    if (buffer.length < 16 || buffer.subarray(0, 16).toString('ascii') !== SQLITE_MAGIC) {
      res.status(400).json({ error: 'File is not a valid SQLite database' });
      return;
    }

    const dataDir = path.resolve(process.cwd(), 'data');
    const tempPath = path.join(dataDir, `upload-${Date.now()}.db`);
    const dbPath = path.join(dataDir, 'tracker.db');
    const backupPath = path.join(dataDir, `tracker-pre-restore-${Date.now()}.db`);

    try {
      // Write upload to temp file and validate
      fs.writeFileSync(tempPath, buffer);
      const testDb = new Database(tempPath, { readonly: true });

      // Verify expected tables exist
      const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
      const tableNames = new Set(tables.map((t: any) => t.name));
      const required = ['users', 'spaces', 'items'];
      const missing = required.filter((t) => !tableNames.has(t));

      if (missing.length > 0) {
        testDb.close();
        fs.unlinkSync(tempPath);
        res.status(400).json({ error: `Invalid database: missing tables: ${missing.join(', ')}` });
        return;
      }

      // Run integrity check
      const integrity = testDb.pragma('integrity_check') as any[];
      testDb.close();

      if (!integrity.length || integrity[0].integrity_check !== 'ok') {
        fs.unlinkSync(tempPath);
        res.status(400).json({ error: 'Database file failed integrity check' });
        return;
      }

      // Back up current database
      const currentDb = getDb();
      currentDb.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

      // Swap: close current → replace → reinitialize
      closeDb();
      fs.copyFileSync(tempPath, dbPath);
      fs.unlinkSync(tempPath);

      // Clean up WAL/SHM files from old DB
      try { fs.unlinkSync(dbPath + '-wal'); } catch { /* may not exist */ }
      try { fs.unlinkSync(dbPath + '-shm'); } catch { /* may not exist */ }

      resetDb();

      res.json({ success: true, backupPath: path.basename(backupPath) });
    } catch (err: any) {
      // Attempt rollback
      try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
      if (fs.existsSync(backupPath) && !fs.existsSync(dbPath)) {
        try {
          fs.copyFileSync(backupPath, dbPath);
          resetDb();
        } catch { /* best effort */ }
      }
      res.status(500).json({ error: `Restore failed: ${err.message}` });
    }
  });
});

export default router;
