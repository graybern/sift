import { readFileSync } from 'fs';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { getDb } from '../db/database.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  // Walk up until we find a .claude directory or root package.json with workspaces
  for (let i = 0; i < 5; i++) {
    try {
      readFileSync(join(dir, '.claude', 'settings.local.json'), 'utf-8');
      return dir;
    } catch {}
    try {
      readFileSync(join(dir, '.claude', 'settings.json'), 'utf-8');
      return dir;
    } catch {}
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function loadProjectClaudeConfig(): Record<string, string> {
  const root = findProjectRoot();
  for (const name of ['settings.local.json', 'settings.json']) {
    try {
      const raw = readFileSync(join(root, '.claude', name), 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.env && typeof parsed.env === 'object') return parsed.env;
    } catch {}
  }
  return {};
}

let _projectConfig: Record<string, string> | null = null;
export function getProjectConfig(): Record<string, string> {
  if (!_projectConfig) _projectConfig = loadProjectClaudeConfig();
  return _projectConfig;
}

interface ItemContext {
  id: string;
  title: string;
  type: string;
  horizon: string;
  priority: number;
  effort: string | null;
  energy: string | null;
  due_date: string | null;
  created_at: string;
  space_name?: string;
  focus_area_name?: string;
}

interface TriageRecommendation {
  id: string;
  itemId: string;
  itemTitle: string;
  action: string;
  reason: string;
  suggestedHorizon?: string;
  suggestedPriority?: number;
}

function getUserSettings(userId: string) {
  const user = getDb()
    .prepare('SELECT settings FROM users WHERE id = ?')
    .get(userId) as { settings: string } | undefined;
  return user?.settings ? JSON.parse(user.settings) : {};
}

// Anthropic API: claude-sonnet-4-6-20250514 → Vertex: claude-sonnet-4-6@20250514
// Already in Vertex format (contains @) or @default → pass through
function toVertexModelName(model: string): string {
  if (model.includes('@')) return model;
  return model.replace(/-(\d{8})$/, '@$1');
}

function createClient(settings: any): { client: Anthropic | AnthropicVertex; model: string } {
  const cfg = getProjectConfig();
  const provider = settings.aiProvider || (cfg.CLAUDE_CODE_USE_VERTEX === '1' ? 'vertex' : 'anthropic');
  const baseModel = settings.anthropicModel || cfg.ANTHROPIC_MODEL || 'claude-sonnet-4-6-20250514';

  if (provider === 'vertex') {
    const projectId = settings.vertexProjectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.ANTHROPIC_VERTEX_PROJECT_ID || cfg.ANTHROPIC_VERTEX_PROJECT_ID;
    const region = settings.vertexRegion || process.env.GOOGLE_CLOUD_REGION || process.env.CLOUD_ML_REGION || cfg.CLOUD_ML_REGION || 'us-east5';

    if (!projectId) {
      throw new Error('Vertex AI requires a project ID. Set it in Settings or via GOOGLE_CLOUD_PROJECT env var.');
    }

    const client = new AnthropicVertex({ projectId, region });
    return { client: client as unknown as Anthropic, model: toVertexModelName(baseModel) };
  }

  if (!settings.anthropicApiKey) {
    throw new Error('No API key configured');
  }

  return { client: new Anthropic({ apiKey: settings.anthropicApiKey }), model: baseModel };
}

function enrichItems(items: any[]): ItemContext[] {
  const db = getDb();
  const spaces = db.prepare('SELECT id, name FROM spaces').all() as any[];
  const focusAreas = db.prepare('SELECT id, name FROM focus_areas').all() as any[];
  const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));
  const faMap = new Map(focusAreas.map((f) => [f.id, f.name]));

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type || 'task',
    horizon: item.horizon,
    priority: item.priority ?? 0,
    effort: item.effort || null,
    energy: item.energy || null,
    due_date: item.due_date || null,
    created_at: item.created_at,
    space_name: item.space_id ? spaceMap.get(item.space_id) : undefined,
    focus_area_name: item.focus_area_id ? faMap.get(item.focus_area_id) : undefined,
  }));
}

export const SYSTEM_PROMPT = `You are a productivity advisor for a personal task tracker. The user organizes tasks through a horizon pipeline: backlog → later → soon → now → done.

Key concepts:
- Horizons represent time proximity: backlog (no time pressure), later (months out), soon (weeks out), now (this week, committed), done (completed)
- Priority: 0 (none), 1 (highest/urgent), 2 (high), 3 (medium), 4 (low)
- Effort: S (small), M (medium), L (large), XL (extra large)
- Energy: deep_focus (requires concentration), light (easy/quick), routine (repetitive)
- Items belong to spaces (like workspaces) and focus areas (sub-categories)

Be direct and actionable. Focus on the most impactful recommendations. Max 8 recommendations.`;

export function prepareTriageRequest(
  userId: string,
  data: { overdue: any[]; staleBacklog: any[]; needsAttention: any[]; dueSoon: any[] }
) {
  const settings = getUserSettings(userId);
  const { client, model } = createClient(settings);

  const allItems = [
    ...enrichItems(data.overdue),
    ...enrichItems(data.staleBacklog),
    ...enrichItems(data.needsAttention),
    ...enrichItems(data.dueSoon),
  ];

  const userMessage = `Review these items that need attention and provide triage recommendations.

Items needing triage:
${JSON.stringify(allItems, null, 2)}

Context:
- ${data.overdue.length} overdue items
- ${data.staleBacklog.length} stale backlog items (3+ days old)
- ${data.needsAttention.length} items in active horizons missing priority/effort
- ${data.dueSoon.length} items due within 7 days

For each recommendation, respond with a JSON array of objects with these fields:
- itemId: the item's id
- itemTitle: the item's title
- action: short action label (e.g., "Move to Now", "Set priority to P1", "Add effort estimate")
- reason: one sentence explaining why
- suggestedHorizon: (optional) "backlog", "later", "soon", or "now"
- suggestedPriority: (optional) 1-4

Respond ONLY with the JSON array, no other text.`;

  return { client, model, allItems, userMessage };
}

export function parseTriageResponse(text: string): TriageRecommendation[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  const parsed = JSON.parse(jsonMatch[0]) as any[];
  return parsed.map((rec, i) => ({
    id: `ai-${i}`,
    itemId: rec.itemId,
    itemTitle: rec.itemTitle,
    action: rec.action,
    reason: rec.reason,
    suggestedHorizon: rec.suggestedHorizon,
    suggestedPriority: rec.suggestedPriority,
  }));
}

export async function triageItems(
  userId: string,
  data: { overdue: any[]; staleBacklog: any[]; needsAttention: any[]; dueSoon: any[] }
): Promise<{ recommendations: TriageRecommendation[] }> {
  const { client, model, allItems, userMessage } = prepareTriageRequest(userId, data);

  if (allItems.length === 0) {
    return { recommendations: [] };
  }

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return { recommendations: parseTriageResponse(text) };
}

export async function focusRecommendation(userId: string): Promise<{ suggestions: any[] }> {
  const settings = getUserSettings(userId);
  const { client, model } = createClient(settings);

  const db = getDb();
  const nowItems = enrichItems(
    db.prepare("SELECT * FROM items WHERE user_id = ? AND horizon = 'now' AND parent_id IS NULL ORDER BY priority ASC, position ASC").all(userId) as any[]
  );
  const soonItems = enrichItems(
    db.prepare("SELECT * FROM items WHERE user_id = ? AND horizon = 'soon' AND parent_id IS NULL ORDER BY priority ASC, position ASC LIMIT 10").all(userId) as any[]
  );

  if (nowItems.length === 0 && soonItems.length === 0) {
    return { suggestions: [] };
  }

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Based on these active items, suggest what to focus on next. Consider priority, effort, energy type, and due dates.

Now (committed this week):
${JSON.stringify(nowItems, null, 2)}

Soon (coming up):
${JSON.stringify(soonItems, null, 2)}

Respond with a JSON array of 1-3 objects:
- itemId: the item's id
- itemTitle: the item's title
- reason: one sentence explaining why to focus on this next
- energyMatch: "deep_focus", "light", or "routine" — what energy level this fits

Respond ONLY with the JSON array, no other text.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return { suggestions: [] };
  }

  return { suggestions: JSON.parse(jsonMatch[0]) };
}

export async function summarizePipeline(userId: string): Promise<{ summary: string }> {
  const settings = getUserSettings(userId);
  const { client, model } = createClient(settings);

  const db = getDb();
  const counts = db.prepare(
    "SELECT horizon, COUNT(*) as count FROM items WHERE user_id = ? AND parent_id IS NULL GROUP BY horizon"
  ).all(userId) as any[];

  const overdue = db.prepare(
    "SELECT COUNT(*) as count FROM items WHERE user_id = ? AND due_date < date('now') AND horizon != 'done' AND parent_id IS NULL"
  ).get(userId) as any;

  const recentlyCompleted = db.prepare(
    "SELECT COUNT(*) as count FROM items WHERE user_id = ? AND horizon = 'done' AND completed_at > datetime('now', '-7 days')"
  ).get(userId) as any;

  const response = await client.messages.create({
    model,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Give a brief 2-3 sentence summary of the user's pipeline state:

Horizon counts: ${JSON.stringify(counts)}
Overdue items: ${overdue?.count || 0}
Completed this week: ${recentlyCompleted?.count || 0}

Be encouraging but honest. Mention any concerns.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return { summary: text };
}
