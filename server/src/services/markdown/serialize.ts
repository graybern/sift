import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import matter from 'gray-matter';
import { getDb } from '../../db/database.js';
import { slugify, uniqueSlug } from './slugify.js';

export interface SerializeResult {
  filesWritten: number;
  filesDeleted: number;
  spaces: number;
  items: number;
}

const HORIZONS = ['backlog', 'later', 'soon', 'now', 'done'] as const;

const SENSITIVE_SETTINGS = new Set([
  'anthropicApiKey',
  'gitAuthToken',
  'gitRepoUrl',
  'gitSyncEnabled',
  'gitBranch',
  'gitSyncInterval',
  'gitSyncPath',
  'gitLastSyncAt',
  'gitLastSyncStatus',
  'gitLastError',
]);

export function serializeToDirectory(userId: string, outputDir: string): SerializeResult {
  const db = getDb();
  const result: SerializeResult = { filesWritten: 0, filesDeleted: 0, spaces: 0, items: 0 };

  const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any;
  const spaces = db.prepare('SELECT * FROM spaces WHERE user_id = ? ORDER BY position').all(userId) as any[];
  const focusAreas = db.prepare('SELECT * FROM focus_areas WHERE user_id = ? ORDER BY position').all(userId) as any[];
  const tags = db.prepare('SELECT * FROM tags WHERE user_id = ?').all(userId) as any[];
  const items = db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY horizon, position').all(userId) as any[];
  const itemTags = db.prepare(`
    SELECT it.item_id, t.name FROM item_tags it
    JOIN tags t ON t.id = it.tag_id
    JOIN items i ON i.id = it.item_id
    WHERE i.user_id = ?
  `).all(userId) as any[];

  const itemTagMap = new Map<string, string[]>();
  for (const it of itemTags) {
    const list = itemTagMap.get(it.item_id) || [];
    list.push(it.name);
    itemTagMap.set(it.item_id, list);
  }

  const spaceMap = new Map<string, any>();
  const spaceSlugMap = new Map<string, string>();
  const spaceSlugs = new Set<string>();
  for (const space of spaces) {
    spaceMap.set(space.id, space);
    const slug = uniqueSlug(space.name, spaceSlugs);
    spaceSlugMap.set(space.id, slug);
  }

  const focusAreaMap = new Map<string, any>();
  for (const fa of focusAreas) {
    focusAreaMap.set(fa.id, fa);
  }

  // Track all files we write so we can clean up stale ones
  const writtenFiles = new Set<string>();

  // Write _meta directory
  const metaDir = path.join(outputDir, '_meta');
  fs.mkdirSync(metaDir, { recursive: true });

  const spacesYml = spaces.map(s => ({
    id: s.id,
    name: s.name,
    color: s.color,
    icon: s.icon,
    position: s.position,
    created_at: s.created_at,
  }));
  const spacesPath = path.join(metaDir, 'spaces.yml');
  fs.writeFileSync(spacesPath, yaml.dump(spacesYml, { lineWidth: -1 }));
  writtenFiles.add(spacesPath);

  const focusAreasYml = focusAreas.map(fa => ({
    id: fa.id,
    space: spaceMap.get(fa.space_id)?.name || null,
    name: fa.name,
    icon: fa.icon,
    position: fa.position,
    created_at: fa.created_at,
  }));
  const focusAreasPath = path.join(metaDir, 'focus-areas.yml');
  fs.writeFileSync(focusAreasPath, yaml.dump(focusAreasYml, { lineWidth: -1 }));
  writtenFiles.add(focusAreasPath);

  const tagsYml = tags.map(t => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }));
  const tagsPath = path.join(metaDir, 'tags.yml');
  fs.writeFileSync(tagsPath, yaml.dump(tagsYml, { lineWidth: -1 }));
  writtenFiles.add(tagsPath);

  // Write settings (non-sensitive only)
  const settings = user?.settings ? JSON.parse(user.settings) : {};
  const safeSettings: Record<string, any> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (!SENSITIVE_SETTINGS.has(key)) {
      safeSettings[key] = value;
    }
  }
  const settingsPath = path.join(metaDir, 'settings.yml');
  fs.writeFileSync(settingsPath, yaml.dump(safeSettings, { lineWidth: -1 }));
  writtenFiles.add(settingsPath);

  result.spaces = spaces.length;

  // Create space and horizon directories
  const allSpaceSlugs = [...spaceSlugMap.values(), '_unassigned'];
  for (const spaceSlug of allSpaceSlugs) {
    for (const horizon of HORIZONS) {
      fs.mkdirSync(path.join(outputDir, spaceSlug, horizon), { recursive: true });
    }
  }

  // Write item files
  const dirSlugs = new Map<string, Set<string>>();

  for (const item of items) {
    const spaceSlug = item.space_id ? (spaceSlugMap.get(item.space_id) || '_unassigned') : '_unassigned';
    const dir = path.join(outputDir, spaceSlug, item.horizon);

    if (!dirSlugs.has(dir)) dirSlugs.set(dir, new Set());
    const slug = uniqueSlug(item.title, dirSlugs.get(dir)!);
    const filePath = path.join(dir, `${slug}.md`);

    const spaceName = item.space_id ? (spaceMap.get(item.space_id)?.name || null) : null;
    const focusAreaName = item.focus_area_id ? (focusAreaMap.get(item.focus_area_id)?.name || null) : null;
    const itemTagNames = itemTagMap.get(item.id) || [];

    let urlMeta = null;
    if (item.url_meta) {
      try {
        urlMeta = JSON.parse(item.url_meta);
      } catch {
        urlMeta = null;
      }
    }

    const frontmatter: Record<string, any> = {
      id: item.id,
      type: item.type,
      priority: item.priority,
      effort: item.effort || null,
      energy: item.energy || null,
      space: spaceName,
      focus_area: focusAreaName,
      tags: itemTagNames.length > 0 ? itemTagNames : [],
      due_date: item.due_date || null,
      completed_at: item.completed_at || null,
      position: item.position,
      parent_id: item.parent_id || null,
      url: item.url || null,
      url_meta: urlMeta,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };

    const body = `# ${item.title}${item.description ? `\n\n${item.description}` : ''}`;
    const content = matter.stringify(body, frontmatter);
    fs.writeFileSync(filePath, content);
    writtenFiles.add(filePath);
    result.filesWritten++;
    result.items++;
  }

  // Clean up stale .md files that no longer correspond to items
  result.filesDeleted = cleanStaleFiles(outputDir, writtenFiles);

  return result;
}

function cleanStaleFiles(outputDir: string, writtenFiles: Set<string>): number {
  let deleted = 0;
  if (!fs.existsSync(outputDir)) return deleted;

  const entries = fs.readdirSync(outputDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(outputDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git') continue;
      deleted += cleanStaleFiles(fullPath, writtenFiles);
    } else if (entry.name.endsWith('.md')) {
      if (!writtenFiles.has(fullPath)) {
        fs.unlinkSync(fullPath);
        deleted++;
      }
    }
  }
  return deleted;
}
