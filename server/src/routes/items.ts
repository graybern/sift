import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/database.js';
import { logActivity, computeChanges } from '../services/activityLogger.js';

const router = Router();

router.get('/', (req, res) => {
  const userId = (req as any).userId;
  const { space_id, horizon, type, parent_id, search, energy, focus_area_id, tag_id } = req.query;

  let sql = 'SELECT items.* FROM items';
  const params: any[] = [];

  if (tag_id) {
    sql += ' JOIN item_tags ON items.id = item_tags.item_id';
    sql += ' WHERE item_tags.tag_id = ? AND items.user_id = ?';
    params.push(tag_id, userId);
  } else {
    sql += ' WHERE items.user_id = ?';
    params.push(userId);
  }

  if (space_id) {
    sql += ' AND items.space_id = ?';
    params.push(space_id);
  }
  if (horizon) {
    sql += ' AND items.horizon = ?';
    params.push(horizon);
  }
  if (type) {
    sql += ' AND items.type = ?';
    params.push(type);
  }
  if (energy) {
    sql += ' AND items.energy = ?';
    params.push(energy);
  }
  if (focus_area_id) {
    sql += ' AND items.focus_area_id = ?';
    params.push(focus_area_id);
  }
  if (parent_id) {
    sql += ' AND items.parent_id = ?';
    params.push(parent_id);
  } else {
    sql += ' AND items.parent_id IS NULL';
  }
  if (search && typeof search === 'string') {
    sql += ' AND items.title LIKE ?';
    params.push(`%${search}%`);
  }

  sql += ' ORDER BY items.position ASC, items.created_at DESC';

  const items = getDb().prepare(sql).all(...params) as any[];

  // Attach tags to each item
  if (items.length > 0) {
    const tagRows = getDb().prepare(
      `SELECT it.item_id, t.id, t.name, t.color
       FROM item_tags it JOIN tags t ON t.id = it.tag_id
       WHERE it.item_id IN (${items.map(() => '?').join(',')})`
    ).all(...items.map((i) => i.id)) as any[];

    const tagMap = new Map<string, any[]>();
    for (const row of tagRows) {
      const list = tagMap.get(row.item_id) || [];
      list.push({ id: row.id, name: row.name, color: row.color });
      tagMap.set(row.item_id, list);
    }

    for (const item of items) {
      item.tags = tagMap.get(item.id) || [];
    }
  }

  res.json(items);
});

router.get('/:id', (req, res) => {
  const userId = (req as any).userId;
  const item = getDb()
    .prepare('SELECT * FROM items WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId);

  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  res.json(item);
});

router.get('/:id/children', (req, res) => {
  const userId = (req as any).userId;
  const children = getDb()
    .prepare('SELECT * FROM items WHERE parent_id = ? AND user_id = ? ORDER BY position ASC')
    .all(req.params.id, userId);
  res.json(children);
});

router.post('/', (req, res) => {
  const userId = (req as any).userId;
  const {
    title,
    space_id,
    parent_id,
    focus_area_id,
    type = 'task',
    description,
    url,
    url_meta,
    priority = 0,
    effort,
    energy,
    horizon = 'backlog',
    due_date,
  } = req.body;

  if (!title?.trim()) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  // Auto-resolve space_id from focus_area if provided
  let resolvedSpaceId = space_id || null;
  if (focus_area_id && !resolvedSpaceId) {
    const fa = getDb().prepare('SELECT space_id FROM focus_areas WHERE id = ?').get(focus_area_id) as any;
    if (fa) resolvedSpaceId = fa.space_id;
  }

  getDb()
    .prepare('UPDATE items SET position = position + 1 WHERE user_id = ? AND horizon = ? AND (space_id = ? OR (space_id IS NULL AND ? IS NULL)) AND parent_id IS NULL')
    .run(userId, horizon, resolvedSpaceId, resolvedSpaceId);

  const id = crypto.randomUUID();
  getDb()
    .prepare(`INSERT INTO items (id, user_id, space_id, parent_id, focus_area_id, type, title, description, url, url_meta, priority, effort, energy, horizon, position, due_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
    .run(id, userId, resolvedSpaceId, parent_id || null, focus_area_id || null, type, title.trim(), description || null, url || null, url_meta ? JSON.stringify(url_meta) : null, priority, effort || null, energy || null, horizon, due_date || null);

  const item = getDb().prepare('SELECT * FROM items WHERE id = ?').get(id) as any;

  logActivity({
    userId, entityType: 'item', entityId: id,
    entityTitle: item.title, action: 'created', snapshot: item,
  });

  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const userId = (req as any).userId;
  const existing = getDb()
    .prepare('SELECT * FROM items WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId);

  if (!existing) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const { title, space_id, type, description, url, url_meta, priority, effort, energy, focus_area_id, horizon, due_date } = req.body;

  let completedAt = (existing as any).completed_at;
  if (horizon === 'done' && (existing as any).horizon !== 'done') {
    completedAt = new Date().toISOString();
  } else if (horizon && horizon !== 'done') {
    completedAt = null;
  }

  getDb()
    .prepare(`UPDATE items SET
      title = COALESCE(?, title),
      space_id = COALESCE(?, space_id),
      type = COALESCE(?, type),
      description = ?,
      url = ?,
      url_meta = COALESCE(?, url_meta),
      priority = COALESCE(?, priority),
      effort = ?,
      energy = ?,
      focus_area_id = ?,
      horizon = COALESCE(?, horizon),
      due_date = ?,
      completed_at = ?,
      updated_at = datetime('now')
    WHERE id = ?`)
    .run(
      title, space_id, type,
      description !== undefined ? description : (existing as any).description,
      url !== undefined ? url : (existing as any).url,
      url_meta ? JSON.stringify(url_meta) : null,
      priority,
      effort !== undefined ? effort : (existing as any).effort,
      energy !== undefined ? energy : (existing as any).energy,
      focus_area_id !== undefined ? focus_area_id : (existing as any).focus_area_id,
      horizon,
      due_date !== undefined ? due_date : (existing as any).due_date,
      completedAt,
      req.params.id
    );

  const item = getDb().prepare('SELECT * FROM items WHERE id = ?').get(req.params.id) as any;

  const changes = computeChanges(existing as any, item);
  if (changes) {
    const action = changes.horizon ? 'moved' : 'updated';
    logActivity({
      userId, entityType: 'item', entityId: req.params.id,
      entityTitle: item.title, action, changes, snapshot: item,
    });
  }

  res.json(item);
});

router.delete('/:id', (req, res) => {
  const userId = (req as any).userId;
  const existing = getDb()
    .prepare('SELECT * FROM items WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId);

  if (!existing) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  logActivity({
    userId, entityType: 'item', entityId: req.params.id,
    entityTitle: (existing as any).title, action: 'deleted', snapshot: existing as any,
  });

  getDb().prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.patch('/:id/horizon', (req, res) => {
  const userId = (req as any).userId;
  const { horizon, position } = req.body;

  if (!horizon) {
    res.status(400).json({ error: 'Horizon is required' });
    return;
  }

  const existing = getDb()
    .prepare('SELECT * FROM items WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId) as any;

  if (!existing) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const completedAt = horizon === 'done' ? new Date().toISOString() : null;
  const newPosition = position ?? 0;

  const transaction = getDb().transaction(() => {
    getDb()
      .prepare('UPDATE items SET position = position + 1 WHERE user_id = ? AND horizon = ? AND position >= ? AND id != ?')
      .run(userId, horizon, newPosition, req.params.id);

    getDb()
      .prepare('UPDATE items SET horizon = ?, position = ?, completed_at = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(horizon, newPosition, completedAt, req.params.id);
  });
  transaction();

  const item = getDb().prepare('SELECT * FROM items WHERE id = ?').get(req.params.id) as any;

  logActivity({
    userId, entityType: 'item', entityId: req.params.id,
    entityTitle: item.title, action: 'moved',
    changes: { horizon: { from: existing.horizon, to: horizon } },
    snapshot: item,
  });

  res.json(item);
});

router.patch('/reorder', (req, res) => {
  const userId = (req as any).userId;
  const { ids } = req.body as { ids: string[] };

  if (!Array.isArray(ids)) {
    res.status(400).json({ error: 'ids array is required' });
    return;
  }

  const update = getDb().prepare('UPDATE items SET position = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?');
  const transaction = getDb().transaction(() => {
    ids.forEach((id, index) => update.run(index, id, userId));
  });
  transaction();

  res.json({ ok: true });
});

// URL metadata fetching
router.post('/url-meta', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Sift/1.0' },
    });
    clearTimeout(timeout);

    const html = await response.text();

    const getMetaContent = (property: string): string | undefined => {
      const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'));
      return match?.[1];
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const meta = {
      title: getMetaContent('og:title') || getMetaContent('twitter:title') || titleMatch?.[1]?.trim(),
      description: getMetaContent('og:description') || getMetaContent('description') || getMetaContent('twitter:description'),
      image: getMetaContent('og:image') || getMetaContent('twitter:image'),
      favicon: (() => {
        const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
        if (iconMatch?.[1]) {
          try {
            return new URL(iconMatch[1], url).href;
          } catch {
            return iconMatch[1];
          }
        }
        try {
          return new URL('/favicon.ico', url).href;
        } catch {
          return undefined;
        }
      })(),
    };

    res.json(meta);
  } catch (err) {
    res.status(422).json({ error: 'Failed to fetch URL metadata' });
  }
});

export default router;
