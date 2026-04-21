import { Router } from 'express';
import { getDb } from '../db/database.js';
import path from 'path';
import fs from 'fs';

const router = Router();

// Export all user data as JSON
router.get('/json', (req, res) => {
  const userId = (req as any).userId;
  const db = getDb();

  const user = db.prepare('SELECT id, username, settings, created_at FROM users WHERE id = ?').get(userId) as any;
  const spaces = db.prepare('SELECT * FROM spaces WHERE user_id = ? ORDER BY position').all(userId);
  const items = db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY horizon, position').all(userId);
  const focusAreas = db.prepare('SELECT * FROM focus_areas WHERE user_id = ? ORDER BY position').all(userId);
  const tags = db.prepare('SELECT * FROM tags WHERE user_id = ?').all(userId);
  const itemTags = db.prepare(`
    SELECT it.* FROM item_tags it
    JOIN items i ON i.id = it.item_id
    WHERE i.user_id = ?
  `).all(userId);

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    scope: 'full' as const,
    settings: user?.settings ? JSON.parse(user.settings) : {},
    spaces,
    focusAreas,
    items,
    tags,
    itemTags,
  };

  const filename = `sift-export-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(exportData);
});

// Export a single space and its items as JSON
router.get('/json/:spaceId', (req, res) => {
  const userId = (req as any).userId;
  const { spaceId } = req.params;
  const db = getDb();

  const space = db.prepare('SELECT * FROM spaces WHERE id = ? AND user_id = ?').get(spaceId, userId) as any;
  if (!space) {
    res.status(404).json({ error: 'Space not found' });
    return;
  }

  // Get items directly in this space + sub-tasks of those items
  const directItems = db.prepare('SELECT * FROM items WHERE space_id = ? AND user_id = ? ORDER BY horizon, position').all(spaceId, userId);
  const directIds = directItems.map((i: any) => i.id);

  let subTasks: any[] = [];
  if (directIds.length > 0) {
    const placeholders = directIds.map(() => '?').join(',');
    subTasks = db.prepare(
      `SELECT * FROM items WHERE parent_id IN (${placeholders}) AND user_id = ? AND (space_id IS NULL OR space_id != ?)`
    ).all(...directIds, userId, spaceId);
  }

  const allItems = [...directItems, ...subTasks];
  const allItemIds = allItems.map((i: any) => i.id);

  // Get tags used by these items
  let tags: any[] = [];
  let itemTags: any[] = [];
  if (allItemIds.length > 0) {
    const placeholders = allItemIds.map(() => '?').join(',');
    itemTags = db.prepare(`SELECT * FROM item_tags WHERE item_id IN (${placeholders})`).all(...allItemIds);
    const tagIds = [...new Set(itemTags.map((it: any) => it.tag_id))];
    if (tagIds.length > 0) {
      const tagPlaceholders = tagIds.map(() => '?').join(',');
      tags = db.prepare(`SELECT * FROM tags WHERE id IN (${tagPlaceholders})`).all(...tagIds);
    }
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    scope: 'space' as const,
    space,
    items: allItems,
    tags,
    itemTags,
  };

  const safeName = space.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filename = `sift-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(exportData);
});

// Download a copy of the SQLite database file
router.get('/db', (_req, res) => {
  const dbPath = path.resolve(process.cwd(), 'data', 'tracker.db');

  if (!fs.existsSync(dbPath)) {
    res.status(404).json({ error: 'Database file not found' });
    return;
  }

  // Use SQLite backup via VACUUM INTO to get a consistent snapshot
  const db = getDb();
  const backupDir = path.resolve(process.cwd(), 'data');
  const backupFilename = `tracker-backup-${Date.now()}.db`;
  const backupPath = path.join(backupDir, backupFilename);

  try {
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

    const downloadName = `sift-backup-${new Date().toISOString().slice(0, 10)}.db`;
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const stream = fs.createReadStream(backupPath);
    stream.pipe(res);
    stream.on('end', () => {
      // Clean up the temporary backup file
      fs.unlink(backupPath, () => {});
    });
    stream.on('error', () => {
      fs.unlink(backupPath, () => {});
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to send backup' });
      }
    });
  } catch {
    fs.unlink(backupPath, () => {});
    res.status(500).json({ error: 'Failed to create database backup' });
  }
});

export default router;
