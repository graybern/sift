import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const userId = (req as any).userId;
  const user = getDb()
    .prepare('SELECT settings FROM users WHERE id = ?')
    .get(userId) as { settings: string } | undefined;

  const defaults = {
    theme: 'dark',
    inFocusLimit: 5,
    autoArchiveDays: 30,
  };

  const settings = user?.settings ? { ...defaults, ...JSON.parse(user.settings) } : defaults;
  res.json(settings);
});

router.put('/', (req, res) => {
  const userId = (req as any).userId;

  // Merge with existing settings
  const user = getDb()
    .prepare('SELECT settings FROM users WHERE id = ?')
    .get(userId) as { settings: string } | undefined;

  const current = user?.settings ? JSON.parse(user.settings) : {};
  const updated = { ...current, ...req.body };

  getDb()
    .prepare('UPDATE users SET settings = ? WHERE id = ?')
    .run(JSON.stringify(updated), userId);

  res.json(updated);
});

export default router;
