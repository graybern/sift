import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const userId = (req as any).userId;
  const db = getDb();
  const { space_id, days: daysParam } = req.query;
  const days = Math.min(Math.max(parseInt(daysParam as string) || 7, 1), 365);

  const spaceFilter = space_id ? ' AND i.space_id = ?' : '';
  const spaceParam = space_id ? [space_id] : [];

  const horizonDistribution = db
    .prepare(`SELECT i.horizon, COUNT(*) as count FROM items i WHERE i.user_id = ? AND i.parent_id IS NULL${spaceFilter} GROUP BY i.horizon`)
    .all(userId, ...spaceParam) as { horizon: string; count: number }[];

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
      WHERE i.user_id = ? AND i.due_date < date('now') AND i.horizon != 'done' AND i.parent_id IS NULL${spaceFilter}
      ORDER BY i.due_date ASC
    `)
    .all(userId, ...spaceParam);

  const dueSoon = db
    .prepare(`
      SELECT i.*, s.name as space_name, s.color as space_color
      FROM items i LEFT JOIN spaces s ON i.space_id = s.id
      WHERE i.user_id = ? AND i.due_date >= date('now') AND i.due_date <= date('now', '+7 days')
        AND i.horizon != 'done' AND i.parent_id IS NULL${spaceFilter}
      ORDER BY i.due_date ASC
    `)
    .all(userId, ...spaceParam);

  const recentlyCompleted = db
    .prepare(`
      SELECT i.*, s.name as space_name, s.color as space_color
      FROM items i LEFT JOIN spaces s ON i.space_id = s.id
      WHERE i.user_id = ? AND i.horizon = 'done' AND i.completed_at >= datetime('now', '-' || ? || ' days')
        AND i.parent_id IS NULL${spaceFilter}
      ORDER BY i.completed_at DESC
    `)
    .all(userId, days, ...spaceParam);

  const velocity = db
    .prepare(`
      SELECT date(i.completed_at) as day, COUNT(*) as count
      FROM items i
      WHERE i.user_id = ? AND i.horizon = 'done' AND i.completed_at >= datetime('now', '-' || ? || ' days') AND i.parent_id IS NULL${spaceFilter}
      GROUP BY date(i.completed_at)
      ORDER BY day ASC
    `)
    .all(userId, days, ...spaceParam) as { day: string; count: number }[];

  const byType = db
    .prepare(`SELECT i.type, COUNT(*) as count FROM items i WHERE i.user_id = ? AND i.parent_id IS NULL${spaceFilter} GROUP BY i.type`)
    .all(userId, ...spaceParam) as { type: string; count: number }[];

  const byPriority = db
    .prepare(`
      SELECT i.priority, COUNT(*) as count
      FROM items i WHERE i.user_id = ? AND i.horizon != 'done' AND i.parent_id IS NULL AND i.priority > 0${spaceFilter}
      GROUP BY i.priority ORDER BY i.priority
    `)
    .all(userId, ...spaceParam) as { priority: number; count: number }[];

  const byEnergy = db
    .prepare(`
      SELECT i.energy, COUNT(*) as count
      FROM items i WHERE i.user_id = ? AND i.horizon != 'done' AND i.parent_id IS NULL AND i.energy IS NOT NULL${spaceFilter}
      GROUP BY i.energy
    `)
    .all(userId, ...spaceParam) as { energy: string; count: number }[];

  const byEffort = db
    .prepare(`
      SELECT i.effort, COUNT(*) as count
      FROM items i WHERE i.user_id = ? AND i.horizon != 'done' AND i.parent_id IS NULL AND i.effort IS NOT NULL${spaceFilter}
      GROUP BY i.effort
    `)
    .all(userId, ...spaceParam) as { effort: string; count: number }[];

  const byFocusArea = db
    .prepare(`
      SELECT fa.name, fa.icon, s.name as space_name, s.color as space_color, COUNT(i.id) as count
      FROM focus_areas fa
      LEFT JOIN items i ON i.focus_area_id = fa.id AND i.parent_id IS NULL AND i.horizon != 'done'
      JOIN spaces s ON fa.space_id = s.id
      WHERE fa.user_id = ?${space_id ? ' AND fa.space_id = ?' : ''}
      GROUP BY fa.id ORDER BY s.position, fa.position
    `)
    .all(userId, ...spaceParam);

  const staleBacklog = db
    .prepare(`
      SELECT i.*, s.name as space_name, s.color as space_color
      FROM items i LEFT JOIN spaces s ON i.space_id = s.id
      WHERE i.user_id = ? AND i.horizon = 'backlog' AND i.created_at <= datetime('now', '-3 days')
        AND i.parent_id IS NULL${spaceFilter}
      ORDER BY i.created_at ASC
    `)
    .all(userId, ...spaceParam);

  const needsAttention = db
    .prepare(`
      SELECT i.*, s.name as space_name, s.color as space_color
      FROM items i LEFT JOIN spaces s ON i.space_id = s.id
      WHERE i.user_id = ? AND i.horizon IN ('later', 'soon', 'now')
        AND (i.priority = 0 OR i.effort IS NULL) AND i.parent_id IS NULL${spaceFilter}
      ORDER BY i.created_at ASC
    `)
    .all(userId, ...spaceParam);

  const totalItems = db
    .prepare(`SELECT COUNT(*) as count FROM items i WHERE i.user_id = ? AND i.parent_id IS NULL${spaceFilter}`)
    .get(userId, ...spaceParam) as { count: number };
  const totalDone = db
    .prepare(`SELECT COUNT(*) as count FROM items i WHERE i.user_id = ? AND i.horizon = 'done' AND i.parent_id IS NULL${spaceFilter}`)
    .get(userId, ...spaceParam) as { count: number };

  const createdPerDay = db
    .prepare(`
      SELECT date(i.created_at) as day, COUNT(*) as count
      FROM items i
      WHERE i.user_id = ? AND i.created_at >= datetime('now', '-' || ? || ' days') AND i.parent_id IS NULL${spaceFilter}
      GROUP BY date(i.created_at)
      ORDER BY day ASC
    `)
    .all(userId, days, ...spaceParam) as { day: string; count: number }[];

  const avgAge = db
    .prepare(`
      SELECT i.horizon,
        ROUND(AVG(julianday('now') - julianday(i.created_at)), 1) as avg_days,
        COUNT(*) as count
      FROM items i
      WHERE i.user_id = ? AND i.horizon != 'done' AND i.parent_id IS NULL${spaceFilter}
      GROUP BY i.horizon
    `)
    .all(userId, ...spaceParam) as { horizon: string; avg_days: number; count: number }[];

  res.json({
    horizonDistribution,
    bySpace,
    byType,
    byPriority,
    byEnergy,
    byEffort,
    byFocusArea,
    overdue,
    dueSoon,
    recentlyCompleted,
    velocity,
    createdPerDay,
    avgAge,
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
