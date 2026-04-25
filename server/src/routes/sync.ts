import { Router } from 'express';
import path from 'path';
import { getDb } from '../db/database.js';
import { syncEngine, SyncConfig } from '../services/gitSync/syncEngine.js';
import { GitManager } from '../services/gitSync/gitManager.js';
import {
  startSyncScheduler,
  stopSyncScheduler,
  isSchedulerRunning,
  getSchedulerConfig,
} from '../services/gitSync/syncScheduler.js';

const router = Router();

function getSyncConfig(userId: string): { enabled: boolean; config: SyncConfig; interval: number } | null {
  const db = getDb();
  const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any;
  const settings = user?.settings ? JSON.parse(user.settings) : {};

  if (!settings.gitSyncEnabled || !settings.gitRepoUrl || !settings.gitAuthToken) {
    return null;
  }

  return {
    enabled: true,
    config: {
      repoUrl: settings.gitRepoUrl,
      branch: settings.gitBranch || 'main',
      authToken: settings.gitAuthToken,
      syncPath: settings.gitSyncPath || path.resolve(process.cwd(), 'data', 'git-sync'),
    },
    interval: settings.gitSyncInterval || 30,
  };
}

router.get('/status', (req, res) => {
  const userId = (req as any).userId;
  const db = getDb();
  const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any;
  const settings = user?.settings ? JSON.parse(user.settings) : {};
  const engineStatus = syncEngine.getStatus();
  const schedulerConfig = getSchedulerConfig();

  const syncInterval = settings.gitSyncInterval || 30;
  let nextSyncAt: string | null = null;
  if (isSchedulerRunning() && engineStatus.lastSyncAt) {
    const lastSync = new Date(engineStatus.lastSyncAt);
    nextSyncAt = new Date(lastSync.getTime() + syncInterval * 60 * 1000).toISOString();
  }

  res.json({
    enabled: !!settings.gitSyncEnabled,
    configured: !!(settings.gitRepoUrl && settings.gitAuthToken),
    repoUrl: settings.gitRepoUrl || null,
    branch: settings.gitBranch || 'main',
    syncInterval,
    lastSyncAt: engineStatus.lastSyncAt,
    lastSyncStatus: engineStatus.lastSyncResult,
    lastError: engineStatus.lastError,
    isSyncing: engineStatus.isSyncing,
    schedulerRunning: isSchedulerRunning(),
    nextSyncAt,
  });
});

router.post('/configure', async (req, res) => {
  const userId = (req as any).userId;
  const { repoUrl, branch, authToken, syncInterval } = req.body;

  if (!repoUrl || !authToken) {
    res.status(400).json({ error: 'repoUrl and authToken are required' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any;
  const current = user?.settings ? JSON.parse(user.settings) : {};

  const syncPath = current.gitSyncPath || path.resolve(process.cwd(), 'data', 'git-sync');
  const resolvedBranch = branch || 'main';
  const resolvedInterval = syncInterval || 30;

  const config: SyncConfig = {
    repoUrl,
    branch: resolvedBranch,
    authToken,
    syncPath,
  };

  try {
    const gm = new GitManager(syncPath);
    await gm.ensureRepo(repoUrl, resolvedBranch, authToken);

    const updated = {
      ...current,
      gitSyncEnabled: true,
      gitRepoUrl: repoUrl,
      gitBranch: resolvedBranch,
      gitAuthToken: authToken,
      gitSyncInterval: resolvedInterval,
      gitSyncPath: syncPath,
    };
    db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(updated), userId);

    startSyncScheduler(userId, config, resolvedInterval);

    res.json({
      success: true,
      message: 'Git sync configured and enabled',
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to configure sync: ${err.message}` });
  }
});

router.post('/test', async (req, res) => {
  const { repoUrl, authToken } = req.body;

  if (!repoUrl || !authToken) {
    res.status(400).json({ error: 'repoUrl and authToken are required' });
    return;
  }

  const gm = new GitManager(path.resolve(process.cwd(), 'data', 'git-sync-test'));
  const result = await gm.testConnection(repoUrl, authToken);
  res.json(result);
});

router.post('/trigger', async (req, res) => {
  const userId = (req as any).userId;
  const syncConfig = getSyncConfig(userId);

  if (!syncConfig) {
    res.status(400).json({ error: 'Git sync is not configured' });
    return;
  }

  const result = await syncEngine.fullSync(userId, syncConfig.config);
  res.json(result);
});

router.post('/push', async (req, res) => {
  const userId = (req as any).userId;
  const syncConfig = getSyncConfig(userId);

  if (!syncConfig) {
    res.status(400).json({ error: 'Git sync is not configured' });
    return;
  }

  const result = await syncEngine.syncPush(userId, syncConfig.config);
  res.json(result);
});

router.post('/pull', async (req, res) => {
  const userId = (req as any).userId;
  const syncConfig = getSyncConfig(userId);

  if (!syncConfig) {
    res.status(400).json({ error: 'Git sync is not configured' });
    return;
  }

  const result = await syncEngine.syncPull(userId, syncConfig.config);
  res.json(result);
});

router.delete('/configure', (req, res) => {
  const userId = (req as any).userId;
  const db = getDb();
  const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any;
  const current = user?.settings ? JSON.parse(user.settings) : {};

  const updated = { ...current };
  delete updated.gitSyncEnabled;
  delete updated.gitRepoUrl;
  delete updated.gitBranch;
  delete updated.gitAuthToken;
  delete updated.gitSyncInterval;
  delete updated.gitSyncPath;

  db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(updated), userId);
  stopSyncScheduler();

  res.json({ success: true, message: 'Git sync disabled' });
});

router.get('/history', (req, res) => {
  const userId = (req as any).userId;
  const limit = parseInt(req.query.limit as string) || 20;
  const db = getDb();

  const entries = db.prepare(
    'SELECT * FROM sync_log WHERE user_id = ? ORDER BY started_at DESC LIMIT ?'
  ).all(userId, limit);

  res.json(entries);
});

export default router;
