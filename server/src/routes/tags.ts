import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const userId = (req as any).userId;
  const tags = getDb().prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC').all(userId);
  res.json(tags);
});

router.post('/', (req, res) => {
  const userId = (req as any).userId;
  const { name, color = '#6b7280' } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const id = crypto.randomUUID();
  getDb().prepare('INSERT INTO tags (id, user_id, name, color) VALUES (?, ?, ?, ?)').run(id, userId, name.trim(), color);

  const tag = getDb().prepare('SELECT * FROM tags WHERE id = ?').get(id);
  res.status(201).json(tag);
});

router.put('/:id', (req, res) => {
  const userId = (req as any).userId;
  const existing = getDb().prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(req.params.id, userId);

  if (!existing) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }

  const { name, color } = req.body;
  getDb().prepare('UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?').run(name, color, req.params.id);

  const tag = getDb().prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  res.json(tag);
});

router.delete('/:id', (req, res) => {
  const userId = (req as any).userId;
  const existing = getDb().prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(req.params.id, userId);

  if (!existing) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }

  getDb().prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Item-tag associations
router.get('/item/:itemId', (req, res) => {
  const tags = getDb().prepare(
    'SELECT t.* FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = ?'
  ).all(req.params.itemId);
  res.json(tags);
});

router.post('/item/:itemId', (req, res) => {
  const { tag_id } = req.body;
  if (!tag_id) {
    res.status(400).json({ error: 'tag_id is required' });
    return;
  }

  const existing = getDb().prepare('SELECT * FROM item_tags WHERE item_id = ? AND tag_id = ?').get(req.params.itemId, tag_id);
  if (existing) {
    res.status(200).json({ ok: true });
    return;
  }

  getDb().prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)').run(req.params.itemId, tag_id);
  res.status(201).json({ ok: true });
});

router.delete('/item/:itemId/:tagId', (req, res) => {
  getDb().prepare('DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?').run(req.params.itemId, req.params.tagId);
  res.status(204).end();
});

export default router;
