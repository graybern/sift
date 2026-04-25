import { Router } from 'express';
import { getDb } from '../db/database.js';
import { getProjectConfig } from '../services/ai.js';

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
    horizonLimits: { later: 15, soon: 8, now: 5 },
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

router.get('/ai-defaults', (_req, res) => {
  const cfg = getProjectConfig();
  res.json({
    vertexDetected: cfg.CLAUDE_CODE_USE_VERTEX === '1',
    vertexProjectId: cfg.ANTHROPIC_VERTEX_PROJECT_ID || '',
    vertexRegion: cfg.CLOUD_ML_REGION || '',
    model: cfg.ANTHROPIC_MODEL || '',
  });
});

export default router;
