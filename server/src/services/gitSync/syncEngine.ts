import path from 'path';
import { getDb } from '../../db/database.js';
import { GitManager } from './gitManager.js';
import { serializeToDirectory } from '../markdown/serialize.js';
import { deserializeFromDirectory } from '../markdown/deserialize.js';
import crypto from 'crypto';

export interface SyncResult {
  direction: 'push' | 'pull' | 'full';
  status: 'success' | 'error';
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncResult: 'success' | 'error' | null;
  lastError: string | null;
}

export class SyncEngine {
  private gitManager: GitManager | null = null;
  private syncing = false;
  private status: SyncStatus = {
    isSyncing: false,
    lastSyncAt: null,
    lastSyncResult: null,
    lastError: null,
  };

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  private getGitManager(syncPath: string): GitManager {
    if (!this.gitManager) {
      this.gitManager = new GitManager(syncPath);
    }
    return this.gitManager;
  }

  async syncPush(userId: string, config: SyncConfig): Promise<SyncResult> {
    return this.runSync(userId, config, 'push');
  }

  async syncPull(userId: string, config: SyncConfig): Promise<SyncResult> {
    return this.runSync(userId, config, 'pull');
  }

  async fullSync(userId: string, config: SyncConfig): Promise<SyncResult> {
    return this.runSync(userId, config, 'full');
  }

  private async runSync(userId: string, config: SyncConfig, direction: 'push' | 'pull' | 'full'): Promise<SyncResult> {
    if (this.syncing) {
      return {
        direction,
        status: 'error',
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        errorMessage: 'A sync is already in progress',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }

    this.syncing = true;
    this.status.isSyncing = true;
    const startedAt = new Date().toISOString();

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;

    try {
      const gm = this.getGitManager(config.syncPath);
      await gm.ensureRepo(config.repoUrl, config.branch, config.authToken);

      if (direction === 'pull' || direction === 'full') {
        const pullResult = await gm.pull(config.branch);
        if (pullResult.filesChanged > 0) {
          const deserResult = deserializeFromDirectory(userId, config.syncPath);
          totalCreated += deserResult.itemsCreated;
          totalUpdated += deserResult.itemsUpdated;
          totalDeleted += deserResult.itemsDeleted;
        }
      }

      if (direction === 'push' || direction === 'full') {
        const serResult = serializeToDirectory(userId, config.syncPath);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const message = `Sift sync: ${serResult.items} items across ${serResult.spaces} spaces (${now})`;

        try {
          await gm.commitAndPush(message, config.branch);
        } catch (err: any) {
          if (err.message?.includes('rejected') || err.message?.includes('non-fast-forward')) {
            await gm.pull(config.branch);
            serializeToDirectory(userId, config.syncPath);
            await gm.commitAndPush(message, config.branch);
          } else {
            throw err;
          }
        }
      }

      const completedAt = new Date().toISOString();
      const result: SyncResult = {
        direction,
        status: 'success',
        itemsCreated: totalCreated,
        itemsUpdated: totalUpdated,
        itemsDeleted: totalDeleted,
        errorMessage: null,
        startedAt,
        completedAt,
      };

      this.status.lastSyncAt = completedAt;
      this.status.lastSyncResult = 'success';
      this.status.lastError = null;

      logSync(userId, result);
      return result;
    } catch (err: any) {
      const completedAt = new Date().toISOString();
      const result: SyncResult = {
        direction,
        status: 'error',
        itemsCreated: totalCreated,
        itemsUpdated: totalUpdated,
        itemsDeleted: totalDeleted,
        errorMessage: err.message || 'Unknown error',
        startedAt,
        completedAt,
      };

      this.status.lastSyncAt = completedAt;
      this.status.lastSyncResult = 'error';
      this.status.lastError = err.message || 'Unknown error';

      logSync(userId, result);
      return result;
    } finally {
      this.syncing = false;
      this.status.isSyncing = false;
    }
  }
}

export interface SyncConfig {
  repoUrl: string;
  branch: string;
  authToken: string;
  syncPath: string;
}

function logSync(userId: string, result: SyncResult): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO sync_log (id, user_id, direction, status, items_created, items_updated, items_deleted, error_message, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(), userId, result.direction, result.status,
      result.itemsCreated, result.itemsUpdated, result.itemsDeleted,
      result.errorMessage, result.startedAt, result.completedAt
    );
  } catch {
    // Don't let logging failures break sync
  }
}

export const syncEngine = new SyncEngine();
