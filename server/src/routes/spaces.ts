import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/database.js';
import { logActivity, computeChanges } from '../services/activityLogger.js';

const router = Router();

router.get('/', (req, res) => {
  const userId = (req as any).userId;
  const spaces = getDb()
    .prepare('SELECT * FROM spaces WHERE user_id = ? ORDER BY position')
    .all(userId);
  res.json(spaces);
});

router.post('/', (req, res) => {
  const userId = (req as any).userId;
  const { name, color = '#3b82f6', icon = 'folder' } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const maxPos = getDb()
    .prepare('SELECT COALESCE(MAX(position), -1) as max FROM spaces WHERE user_id = ?')
    .get(userId) as { max: number };

  const id = crypto.randomUUID();
  getDb()
    .prepare('INSERT INTO spaces (id, user_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, userId, name.trim(), color, icon, maxPos.max + 1);

  const space = getDb().prepare('SELECT * FROM spaces WHERE id = ?').get(id) as any;

  logActivity({
    userId, entityType: 'space', entityId: id,
    entityTitle: space.name, action: 'created', snapshot: space,
  });

  res.status(201).json(space);
});

router.put('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { name, color, icon } = req.body;

  const existing = getDb()
    .prepare('SELECT * FROM spaces WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId);

  if (!existing) {
    res.status(404).json({ error: 'Space not found' });
    return;
  }

  getDb()
    .prepare('UPDATE spaces SET name = COALESCE(?, name), color = COALESCE(?, color), icon = COALESCE(?, icon) WHERE id = ?')
    .run(name, color, icon, req.params.id);

  const space = getDb().prepare('SELECT * FROM spaces WHERE id = ?').get(req.params.id) as any;

  const changes = computeChanges(existing as any, space);
  if (changes) {
    logActivity({
      userId, entityType: 'space', entityId: req.params.id,
      entityTitle: space.name, action: 'updated', changes, snapshot: space,
    });
  }

  res.json(space);
});

router.delete('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { moveItemsTo } = req.query;

  const existing = getDb()
    .prepare('SELECT * FROM spaces WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId);

  if (!existing) {
    res.status(404).json({ error: 'Space not found' });
    return;
  }

  if (moveItemsTo && typeof moveItemsTo === 'string') {
    getDb()
      .prepare('UPDATE items SET space_id = ? WHERE space_id = ?')
      .run(moveItemsTo, req.params.id);
  }

  logActivity({
    userId, entityType: 'space', entityId: req.params.id,
    entityTitle: (existing as any).name, action: 'deleted', snapshot: existing as any,
  });

  getDb().prepare('DELETE FROM spaces WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.patch('/reorder', (req, res) => {
  const userId = (req as any).userId;
  const { ids } = req.body as { ids: string[] };

  if (!Array.isArray(ids)) {
    res.status(400).json({ error: 'ids array is required' });
    return;
  }

  const update = getDb().prepare('UPDATE spaces SET position = ? WHERE id = ? AND user_id = ?');
  const transaction = getDb().transaction(() => {
    ids.forEach((id, index) => update.run(index, id, userId));
  });
  transaction();

  res.json({ ok: true });
});

export default router;
