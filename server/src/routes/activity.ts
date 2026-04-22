import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/database.js';
import { logActivity } from '../services/activityLogger.js';

const router = Router();

router.get('/', (req, res) => {
  const userId = (req as any).userId;
  const { entity_type, action, limit = '50', offset = '0', entity_id } = req.query;

  let sql = 'SELECT * FROM activity_log WHERE user_id = ?';
  const params: any[] = [userId];

  if (entity_type && typeof entity_type === 'string') {
    sql += ' AND entity_type = ?';
    params.push(entity_type);
  }
  if (action && typeof action === 'string') {
    sql += ' AND action = ?';
    params.push(action);
  }
  if (entity_id && typeof entity_id === 'string') {
    sql += ' AND entity_id = ?';
    params.push(entity_id);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const entries = getDb().prepare(sql).all(...params) as any[];

  const countSql = sql
    .replace('SELECT *', 'SELECT COUNT(*) as total')
    .replace(/ ORDER BY.*$/, '');
  const countParams = params.slice(0, -2);
  const { total } = getDb().prepare(countSql).get(...countParams) as { total: number };

  const parsed = entries.map((e) => ({
    ...e,
    changes: e.changes ? JSON.parse(e.changes) : null,
    snapshot: e.snapshot ? JSON.parse(e.snapshot) : null,
  }));

  res.json({ entries: parsed, total });
});

router.post('/:id/revert', (req, res) => {
  const userId = (req as any).userId;
  const db = getDb();

  const entry = db
    .prepare('SELECT * FROM activity_log WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId) as any;

  if (!entry) {
    res.status(404).json({ error: 'Activity entry not found' });
    return;
  }

  const snapshot = JSON.parse(entry.snapshot);

  if (entry.entity_type === 'item') {
    if (entry.action === 'deleted') {
      db.prepare(
        `INSERT OR REPLACE INTO items (id, user_id, space_id, parent_id, focus_area_id, type, title, description, url, url_meta, priority, effort, energy, horizon, position, due_date, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        snapshot.id, snapshot.user_id, snapshot.space_id, snapshot.parent_id,
        snapshot.focus_area_id, snapshot.type, snapshot.title, snapshot.description,
        snapshot.url, snapshot.url_meta, snapshot.priority, snapshot.effort,
        snapshot.energy, snapshot.horizon, snapshot.position, snapshot.due_date,
        snapshot.completed_at, snapshot.created_at
      );
    } else {
      db.prepare(
        `UPDATE items SET title = ?, space_id = ?, focus_area_id = ?, type = ?, description = ?, url = ?, url_meta = ?, priority = ?, effort = ?, energy = ?, horizon = ?, position = ?, due_date = ?, completed_at = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`
      ).run(
        snapshot.title, snapshot.space_id, snapshot.focus_area_id, snapshot.type,
        snapshot.description, snapshot.url, snapshot.url_meta, snapshot.priority,
        snapshot.effort, snapshot.energy, snapshot.horizon, snapshot.position,
        snapshot.due_date, snapshot.completed_at, snapshot.id, userId
      );
    }

    const restored = db.prepare('SELECT * FROM items WHERE id = ?').get(snapshot.id) as any;

    logActivity({
      userId, entityType: 'item', entityId: snapshot.id,
      entityTitle: snapshot.title, action: 'updated',
      changes: { _revert: { from: entry.id, to: 'reverted' } },
      snapshot: restored,
    });

    res.json({ success: true, entity: restored });
    return;
  }

  if (entry.entity_type === 'space') {
    if (entry.action === 'deleted') {
      db.prepare(
        'INSERT OR REPLACE INTO spaces (id, user_id, name, color, icon, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(snapshot.id, snapshot.user_id, snapshot.name, snapshot.color, snapshot.icon, snapshot.position, snapshot.created_at);
    } else {
      db.prepare(
        'UPDATE spaces SET name = ?, color = ?, icon = ?, position = ? WHERE id = ? AND user_id = ?'
      ).run(snapshot.name, snapshot.color, snapshot.icon, snapshot.position, snapshot.id, userId);
    }

    const restored = db.prepare('SELECT * FROM spaces WHERE id = ?').get(snapshot.id);
    res.json({ success: true, entity: restored });
    return;
  }

  if (entry.entity_type === 'focus_area') {
    if (entry.action === 'deleted') {
      db.prepare(
        'INSERT OR REPLACE INTO focus_areas (id, user_id, space_id, name, icon, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(snapshot.id, snapshot.user_id, snapshot.space_id, snapshot.name, snapshot.icon, snapshot.position, snapshot.created_at);
    } else {
      db.prepare(
        'UPDATE focus_areas SET name = ?, icon = ?, position = ? WHERE id = ? AND user_id = ?'
      ).run(snapshot.name, snapshot.icon, snapshot.position, snapshot.id, userId);
    }

    const restored = db.prepare('SELECT * FROM focus_areas WHERE id = ?').get(snapshot.id);
    res.json({ success: true, entity: restored });
    return;
  }

  res.status(400).json({ error: `Cannot revert entity type: ${entry.entity_type}` });
});

export default router;
