import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/database.js';
import { logActivity, computeChanges } from '../services/activityLogger.js';

const router = Router();

router.get('/', (req, res) => {
  const userId = (req as any).userId;
  const { space_id } = req.query;

  let sql = 'SELECT * FROM focus_areas WHERE user_id = ?';
  const params: any[] = [userId];

  if (space_id) {
    sql += ' AND space_id = ?';
    params.push(space_id);
  }

  sql += ' ORDER BY position ASC, created_at ASC';
  const areas = getDb().prepare(sql).all(...params);
  res.json(areas);
});

router.post('/', (req, res) => {
  const userId = (req as any).userId;
  const { name, space_id, icon = 'folder' } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (!space_id) {
    res.status(400).json({ error: 'space_id is required' });
    return;
  }

  const space = getDb().prepare('SELECT id FROM spaces WHERE id = ? AND user_id = ?').get(space_id, userId);
  if (!space) {
    res.status(404).json({ error: 'Space not found' });
    return;
  }

  const maxPos = (getDb().prepare('SELECT MAX(position) as max FROM focus_areas WHERE space_id = ? AND user_id = ?').get(space_id, userId) as any)?.max ?? -1;

  const id = crypto.randomUUID();
  getDb().prepare(
    'INSERT INTO focus_areas (id, user_id, space_id, name, icon, position) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, space_id, name.trim(), icon, maxPos + 1);

  const area = getDb().prepare('SELECT * FROM focus_areas WHERE id = ?').get(id) as any;

  logActivity({
    userId, entityType: 'focus_area', entityId: id,
    entityTitle: area.name, action: 'created', snapshot: area,
  });

  res.status(201).json(area);
});

router.put('/:id', (req, res) => {
  const userId = (req as any).userId;
  const existing = getDb().prepare('SELECT * FROM focus_areas WHERE id = ? AND user_id = ?').get(req.params.id, userId);

  if (!existing) {
    res.status(404).json({ error: 'Focus area not found' });
    return;
  }

  const { name, icon } = req.body;

  getDb().prepare(
    'UPDATE focus_areas SET name = COALESCE(?, name), icon = COALESCE(?, icon) WHERE id = ?'
  ).run(name, icon, req.params.id);

  const area = getDb().prepare('SELECT * FROM focus_areas WHERE id = ?').get(req.params.id) as any;

  const changes = computeChanges(existing as any, area);
  if (changes) {
    logActivity({
      userId, entityType: 'focus_area', entityId: req.params.id,
      entityTitle: area.name, action: 'updated', changes, snapshot: area,
    });
  }

  res.json(area);
});

router.delete('/:id', (req, res) => {
  const userId = (req as any).userId;
  const existing = getDb().prepare('SELECT * FROM focus_areas WHERE id = ? AND user_id = ?').get(req.params.id, userId);

  if (!existing) {
    res.status(404).json({ error: 'Focus area not found' });
    return;
  }

  logActivity({
    userId, entityType: 'focus_area', entityId: req.params.id,
    entityTitle: (existing as any).name, action: 'deleted', snapshot: existing as any,
  });

  getDb().prepare('DELETE FROM focus_areas WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.patch('/reorder', (req, res) => {
  const userId = (req as any).userId;
  const { ids } = req.body as { ids: string[] };

  if (!Array.isArray(ids)) {
    res.status(400).json({ error: 'ids array is required' });
    return;
  }

  const update = getDb().prepare('UPDATE focus_areas SET position = ? WHERE id = ? AND user_id = ?');
  const transaction = getDb().transaction(() => {
    ids.forEach((id, index) => update.run(index, id, userId));
  });
  transaction();

  res.json({ ok: true });
});

export default router;
