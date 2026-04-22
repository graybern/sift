import crypto from 'crypto';
import { getDb } from '../db/database.js';

type EntityType = 'item' | 'space' | 'focus_area';
type Action = 'created' | 'updated' | 'deleted' | 'moved';

interface LogOptions {
  userId: string;
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  action: Action;
  changes?: Record<string, { from: unknown; to: unknown }>;
  snapshot: Record<string, unknown>;
}

export function logActivity({ userId, entityType, entityId, entityTitle, action, changes, snapshot }: LogOptions) {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO activity_log (id, user_id, entity_type, entity_id, entity_title, action, changes, snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      userId,
      entityType,
      entityId,
      entityTitle,
      action,
      changes ? JSON.stringify(changes) : null,
      JSON.stringify(snapshot)
    );
}

export function computeChanges(before: Record<string, any>, after: Record<string, any>): Record<string, { from: unknown; to: unknown }> | undefined {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const skip = new Set(['updated_at', 'created_at']);

  for (const key of Object.keys(after)) {
    if (skip.has(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = { from: before[key], to: after[key] };
    }
  }

  return Object.keys(diff).length > 0 ? diff : undefined;
}
