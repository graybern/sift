import { syncEngine, SyncConfig } from './syncEngine.js';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let currentConfig: { userId: string; config: SyncConfig; intervalMinutes: number } | null = null;

export function startSyncScheduler(userId: string, config: SyncConfig, intervalMinutes: number): void {
  stopSyncScheduler();
  currentConfig = { userId, config, intervalMinutes };

  syncInterval = setInterval(async () => {
    try {
      await syncEngine.fullSync(userId, config);
    } catch (err) {
      console.error('[Sift Sync] Scheduled sync failed:', err);
    }
  }, intervalMinutes * 60 * 1000);

  console.log(`[Sift Sync] Scheduler started: every ${intervalMinutes} minutes`);
}

export function stopSyncScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    currentConfig = null;
    console.log('[Sift Sync] Scheduler stopped');
  }
}

export function restartSyncScheduler(userId: string, config: SyncConfig, intervalMinutes: number): void {
  startSyncScheduler(userId, config, intervalMinutes);
}

export function isSchedulerRunning(): boolean {
  return syncInterval !== null;
}

export function getSchedulerConfig(): { intervalMinutes: number } | null {
  if (!currentConfig) return null;
  return { intervalMinutes: currentConfig.intervalMinutes };
}
