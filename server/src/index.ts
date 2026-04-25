import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/database.js';
import { authMiddleware } from './middleware/auth.js';
import spacesRouter from './routes/spaces.js';
import itemsRouter from './routes/items.js';
import settingsRouter from './routes/settings.js';
import aiRouter from './routes/ai.js';
import statsRouter from './routes/stats.js';
import exportRouter from './routes/export.js';
import importRouter from './routes/import.js';
import focusAreasRouter from './routes/focusAreas.js';
import reviewsRouter from './routes/reviews.js';
import tagsRouter from './routes/tags.js';
import activityRouter from './routes/activity.js';
import syncRouter from './routes/sync.js';
import { startSyncScheduler } from './services/gitSync/syncScheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware);

// API routes
app.use('/api/spaces', spacesRouter);
app.use('/api/items', itemsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/stats', statsRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/focus-areas', focusAreasRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/sync', syncRouter);

// In production, serve the client build
if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Initialize database
const db = getDb();

// Start git sync scheduler if configured
try {
  const user = db.prepare('SELECT settings FROM users WHERE id = ?').get('default') as any;
  const settings = user?.settings ? JSON.parse(user.settings) : {};
  if (settings.gitSyncEnabled && settings.gitRepoUrl && settings.gitAuthToken) {
    const syncPath = settings.gitSyncPath || path.resolve(process.cwd(), 'data', 'git-sync');
    startSyncScheduler('default', {
      repoUrl: settings.gitRepoUrl,
      branch: settings.gitBranch || 'main',
      authToken: settings.gitAuthToken,
      syncPath,
    }, settings.gitSyncInterval || 30);
  }
} catch (err) {
  console.error('[Sift Sync] Failed to start scheduler on boot:', err);
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
