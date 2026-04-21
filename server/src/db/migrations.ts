import type Database from 'better-sqlite3';
import crypto from 'crypto';

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      icon TEXT DEFAULT 'folder',
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6b7280'
    );

    CREATE TABLE IF NOT EXISTS item_tags (
      item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
      tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_spaces_user_id ON spaces(user_id);
  `);

  // Schema versioning via user_version pragma
  const version = (db.pragma('user_version') as any[])[0]?.user_version ?? 0;

  if (version === 0) {
    // Check if items table already exists (existing DB with old stage column)
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='items'"
    ).get();

    if (tableExists) {
      // Migrate: rename old table, create new with horizon, copy data with mapping
      db.exec(`
        ALTER TABLE items RENAME TO items_old;

        CREATE TABLE items (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
          parent_id TEXT REFERENCES items(id) ON DELETE CASCADE,
          type TEXT NOT NULL DEFAULT 'task',
          title TEXT NOT NULL,
          description TEXT,
          url TEXT,
          url_meta TEXT,
          priority INTEGER DEFAULT 0,
          effort TEXT,
          horizon TEXT NOT NULL DEFAULT 'backlog',
          position INTEGER DEFAULT 0,
          due_date TEXT,
          completed_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        INSERT INTO items (id, user_id, space_id, parent_id, type, title, description, url, url_meta, priority, effort, horizon, position, due_date, completed_at, created_at, updated_at)
        SELECT id, user_id, space_id, parent_id, type, title, description, url, url_meta, priority, effort,
          CASE stage
            WHEN 'inbox' THEN 'backlog'
            WHEN 'someday' THEN 'backlog'
            WHEN 'up_next' THEN 'later'
            WHEN 'in_focus' THEN 'now'
            WHEN 'done' THEN 'done'
            ELSE 'backlog'
          END,
          position, due_date, completed_at, created_at, updated_at
        FROM items_old;

        DROP TABLE items_old;
      `);
    } else {
      // Fresh DB: create items table with horizon from the start
      db.exec(`
        CREATE TABLE items (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
          parent_id TEXT REFERENCES items(id) ON DELETE CASCADE,
          type TEXT NOT NULL DEFAULT 'task',
          title TEXT NOT NULL,
          description TEXT,
          url TEXT,
          url_meta TEXT,
          priority INTEGER DEFAULT 0,
          effort TEXT,
          horizon TEXT NOT NULL DEFAULT 'backlog',
          position INTEGER DEFAULT 0,
          due_date TEXT,
          completed_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
      CREATE INDEX IF NOT EXISTS idx_items_space_id ON items(space_id);
      CREATE INDEX IF NOT EXISTS idx_items_horizon ON items(horizon);
      CREATE INDEX IF NOT EXISTS idx_items_parent_id ON items(parent_id);
    `);

    db.pragma('user_version = 1');
  }

  if ((db.pragma('user_version') as any[])[0]?.user_version === 1) {
    db.exec(`ALTER TABLE items ADD COLUMN energy TEXT;`);
    db.pragma('user_version = 2');
  }

  if ((db.pragma('user_version') as any[])[0]?.user_version === 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS focus_areas (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'folder',
        position INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_focus_areas_space_id ON focus_areas(space_id);
      CREATE INDEX IF NOT EXISTS idx_focus_areas_user_id ON focus_areas(user_id);

      ALTER TABLE items ADD COLUMN focus_area_id TEXT REFERENCES focus_areas(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_items_focus_area_id ON items(focus_area_id);
    `);
    db.pragma('user_version = 3');
  }

  if ((db.pragma('user_version') as any[])[0]?.user_version === 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS review_snapshots (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        snapshot_type TEXT NOT NULL DEFAULT 'weekly',
        metrics TEXT NOT NULL DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_review_snapshots_user_id ON review_snapshots(user_id);
      CREATE INDEX IF NOT EXISTS idx_review_snapshots_period ON review_snapshots(period_start, period_end);
    `);
    db.pragma('user_version = 4');
  }

  if ((db.pragma('user_version') as any[])[0]?.user_version === 4) {
    // Fix item_tags FK referencing items_old from the stage→horizon migration
    const itemTagsSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='item_tags'").get() as any;
    if (itemTagsSchema?.sql?.includes('items_old')) {
      db.exec(`
        DROP TABLE IF EXISTS item_tags;
        CREATE TABLE item_tags (
          item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
          tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (item_id, tag_id)
        );
      `);
    }
    db.pragma('user_version = 5');
  }

  // Seed default user if none exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    db.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run('default', 'default');

    const defaultSpaces = [
      { id: crypto.randomUUID(), name: 'Work', color: '#3b82f6', icon: 'briefcase', position: 0 },
      { id: crypto.randomUUID(), name: 'Home', color: '#10b981', icon: 'home', position: 1 },
      { id: crypto.randomUUID(), name: 'Homelab', color: '#8b5cf6', icon: 'server', position: 2 },
    ];

    const insertSpace = db.prepare(
      'INSERT INTO spaces (id, user_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?, ?)'
    );

    for (const space of defaultSpaces) {
      insertSpace.run(space.id, 'default', space.name, space.color, space.icon, space.position);
    }
  }
}
