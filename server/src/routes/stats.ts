import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const userId = (req as any).userId;
  const db = getDb();

  const horizonDistribution = db
    .prepare('SELECT horizon, COUNT(*) as count FROM items WHERE user_id = ? AND parent_id IS NULL GROUP BY horizon')
    .all(userId) as { horizon: string; count: number }[];

  const bySpace = db
    .prepare(`
      SELECT s.name, s.color, COUNT(i.id) as count
      FROM spaces s LEFT JOIN items i ON i.space_id = s.id AND i.parent_id IS NULL
      WHERE s.user_id = ?
      GROUP BY s.id ORDER BY s.position
    `)
    .all(userId) as { name: string; color: string; count: number }[];

  const overdue = db
    .prepare(`
      SELECT i.*, s.name as space_name, s.color as space_color
      FROM items i LEFT JOIN spaces s ON i.space_id = s.id
      WHERE i.user_id = ? AND i.due_date < date('now') AND i.horizon != 'done' AND i.parent_id IS NULL
      ORDER BY i.due_date ASC
    `)
    .all(userId);

  const dueSoon = db
    .prepare(`
      SELECT i.*, s.name as space_name, s.color as space_color
      FROM items i LEFT JOIN spaces s ON i.space_id = s.id
      WHERE i.user_id = ? AND i.due_date >= date('now') AND i.due_date <= date('now', '+7 days')
        AND i.horizon != 'done' AND i.parent_id IS NULL
      ORDER BY i.due_date ASC
    `)
    .all(userId);

  const recentlyCompleted = db
    .prepare(`
      SELECT i.*, s.name as space_name, s.color as space_color
      FROM items i LEFT JOIN spaces s ON i.space_id = s.id
      WHERE i.user_id = ? AND i.horizon = 'done' AND i.completed_at >= datetime('now', '-14 days')
        AND i.parent_id IS NULL
      ORDER BY i.completed_at DESC
    `)
    .all(userId);

  const velocity = db
    .prepare(`
      SELECT date(completed_at) as day, COUNT(*) as count
      FROM items
      WHERE user_id = ? AND horizon = 'done' AND completed_at >= datetime('now', '-14 days') AND parent_id IS NULL
      GROUP BY date(completed_at)
      ORDER BY day ASC
    `)
    .all(userId) as { day: string; count: number }[];

  const byType = db
    .prepare('SELECT type, COUNT(*) as count FROM items WHERE user_id = ? AND parent_id IS NULL GROUP BY type')
    .all(userId) as { type: string; count: number }[];

  const byPriority = db
    .prepare(`
      SELECT priority, COUNT(*) as count
      FROM items WHERE user_id = ? AND horizon != 'done' AND parent_id IS NULL AND priority > 0
      GROUP BY priority ORDER BY priority
    `)
    .all(userId) as { priority: number; count: number }[];

  const byEnergy = db
    .prepare(`
      SELECT energy, COUNT(*) as count
      FROM items WHERE user_id = ? AND horizon != 'done' AND parent_id IS NULL AND energy IS NOT NULL
      GROUP BY energy
    `)
    .all(userId) as { energy: string; count: number }[];

  const byFocusArea = db
    .prepare(`
      SELECT fa.name, fa.icon, s.name as space_name, s.color as space_color, COUNT(i.id) as count
      FROM focus_areas fa
      LEFT JOIN items i ON i.focus_area_id = fa.id AND i.parent_id IS NULL AND i.horizon != 'done'
      JOIN spaces s ON fa.space_id = s.id
      WHERE fa.user_id = ?
      GROUP BY fa.id ORDER BY s.position, fa.position
    `)
    .all(userId);

  const staleBacklog = db
    .prepare(`
      SELECT i.*, s.name as space_name, s.color as space_color
      FROM items i LEFT JOIN spaces s ON i.space_id = s.id
      WHERE i.user_id = ? AND i.horizon = 'backlog' AND i.created_at <= datetime('now', '-3 days')
        AND i.parent_id IS NULL
      ORDER BY i.created_at ASC
    `)
    .all(userId);

  const needsAttention = db
    .prepare(`
      SELECT i.*, s.name as space_name, s.color as space_color
      FROM items i LEFT JOIN spaces s ON i.space_id = s.id
      WHERE i.user_id = ? AND i.horizon IN ('later', 'soon', 'now')
        AND (i.priority = 0 OR i.effort IS NULL) AND i.parent_id IS NULL
      ORDER BY i.created_at ASC
    `)
    .all(userId);

  const totalItems = db
    .prepare('SELECT COUNT(*) as count FROM items WHERE user_id = ? AND parent_id IS NULL')
    .get(userId) as { count: number };
  const totalDone = db
    .prepare('SELECT COUNT(*) as count FROM items WHERE user_id = ? AND horizon = \'done\' AND parent_id IS NULL')
    .get(userId) as { count: number };

  res.json({
    horizonDistribution,
    bySpace,
    byType,
    byPriority,
    byEnergy,
    byFocusArea,
    overdue,
    dueSoon,
    recentlyCompleted,
    velocity,
    staleBacklog,
    needsAttention,
    totals: {
      all: totalItems.count,
      done: totalDone.count,
      active: totalItems.count - totalDone.count,
    },
  });
});

export default router;
