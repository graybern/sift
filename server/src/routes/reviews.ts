import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/database.js';

const router = Router();

function getWeekBounds(date: Date = new Date()): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function generateSnapshot(userId: string, periodStart: string, periodEnd: string) {
  const db = getDb();

  const completed = db.prepare(`
    SELECT COUNT(*) as count FROM items
    WHERE user_id = ? AND horizon = 'done' AND completed_at >= ? AND completed_at <= ? AND parent_id IS NULL
  `).get(userId, periodStart, periodEnd + 'T23:59:59') as { count: number };

  const completedByType = db.prepare(`
    SELECT type, COUNT(*) as count FROM items
    WHERE user_id = ? AND horizon = 'done' AND completed_at >= ? AND completed_at <= ? AND parent_id IS NULL
    GROUP BY type
  `).all(userId, periodStart, periodEnd + 'T23:59:59');

  const completedByEnergy = db.prepare(`
    SELECT energy, COUNT(*) as count FROM items
    WHERE user_id = ? AND horizon = 'done' AND completed_at >= ? AND completed_at <= ? AND parent_id IS NULL AND energy IS NOT NULL
    GROUP BY energy
  `).all(userId, periodStart, periodEnd + 'T23:59:59');

  const horizonDistribution = db.prepare(`
    SELECT horizon, COUNT(*) as count FROM items
    WHERE user_id = ? AND parent_id IS NULL
    GROUP BY horizon
  `).all(userId);

  const activeCount = db.prepare(`
    SELECT COUNT(*) as count FROM items
    WHERE user_id = ? AND horizon != 'done' AND parent_id IS NULL
  `).get(userId) as { count: number };

  const rolledOver = db.prepare(`
    SELECT COUNT(*) as count FROM items
    WHERE user_id = ? AND horizon IN ('now', 'soon') AND created_at < ? AND parent_id IS NULL
  `).get(userId, periodStart) as { count: number };

  const dailyVelocity = db.prepare(`
    SELECT date(completed_at) as day, COUNT(*) as count FROM items
    WHERE user_id = ? AND horizon = 'done' AND completed_at >= ? AND completed_at <= ? AND parent_id IS NULL
    GROUP BY date(completed_at) ORDER BY day
  `).all(userId, periodStart, periodEnd + 'T23:59:59');

  return {
    completed: completed.count,
    completedByType,
    completedByEnergy,
    horizonDistribution,
    activeItems: activeCount.count,
    rolledOver: rolledOver.count,
    dailyVelocity,
  };
}

// List snapshots
router.get('/', (req, res) => {
  const userId = (req as any).userId;
  const { limit = '10', offset = '0' } = req.query;

  const snapshots = getDb().prepare(`
    SELECT * FROM review_snapshots WHERE user_id = ?
    ORDER BY period_start DESC LIMIT ? OFFSET ?
  `).all(userId, Number(limit), Number(offset));

  const parsed = snapshots.map((s: any) => ({
    ...s,
    metrics: JSON.parse(s.metrics),
  }));

  res.json(parsed);
});

// Get or generate current week's snapshot
router.get('/current', (req, res) => {
  const userId = (req as any).userId;
  const { start, end } = getWeekBounds();

  const existing = getDb().prepare(`
    SELECT * FROM review_snapshots
    WHERE user_id = ? AND period_start = ? AND period_end = ?
  `).get(userId, start, end) as any;

  if (existing) {
    // Regenerate metrics for the current (in-progress) week
    const metrics = generateSnapshot(userId, start, end);
    getDb().prepare('UPDATE review_snapshots SET metrics = ? WHERE id = ?')
      .run(JSON.stringify(metrics), existing.id);
    res.json({ ...existing, metrics });
    return;
  }

  // Create new snapshot for this week
  const metrics = generateSnapshot(userId, start, end);
  const id = crypto.randomUUID();
  getDb().prepare(`
    INSERT INTO review_snapshots (id, user_id, period_start, period_end, snapshot_type, metrics)
    VALUES (?, ?, ?, ?, 'weekly', ?)
  `).run(id, userId, start, end, JSON.stringify(metrics));

  const snapshot = getDb().prepare('SELECT * FROM review_snapshots WHERE id = ?').get(id) as any;
  res.json({ ...snapshot, metrics });
});

// Manually trigger snapshot generation
router.post('/generate', (req, res) => {
  const userId = (req as any).userId;
  const { period_start, period_end } = req.body;

  const start = period_start || getWeekBounds().start;
  const end = period_end || getWeekBounds().end;

  const existing = getDb().prepare(`
    SELECT id FROM review_snapshots WHERE user_id = ? AND period_start = ? AND period_end = ?
  `).get(userId, start, end) as any;

  const metrics = generateSnapshot(userId, start, end);

  if (existing) {
    getDb().prepare('UPDATE review_snapshots SET metrics = ? WHERE id = ?')
      .run(JSON.stringify(metrics), existing.id);
    res.json({ id: existing.id, metrics, updated: true });
  } else {
    const id = crypto.randomUUID();
    getDb().prepare(`
      INSERT INTO review_snapshots (id, user_id, period_start, period_end, snapshot_type, metrics)
      VALUES (?, ?, ?, ?, 'weekly', ?)
    `).run(id, userId, start, end, JSON.stringify(metrics));
    res.json({ id, metrics, created: true });
  }
});

export default router;
