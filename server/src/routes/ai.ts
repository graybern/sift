import { Router } from 'express';
import { triageItems, focusRecommendation, summarizePipeline } from '../services/ai.js';

const router = Router();

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 30_000;

function checkRateLimit(userId: string): boolean {
  const last = rateLimitMap.get(userId);
  if (last && Date.now() - last < RATE_LIMIT_MS) return false;
  rateLimitMap.set(userId, Date.now());
  return true;
}

router.post('/triage', async (req, res) => {
  const userId = (req as any).userId;

  if (!checkRateLimit(`triage:${userId}`)) {
    res.status(429).json({ error: 'Please wait before analyzing again' });
    return;
  }

  try {
    const result = await triageItems(userId, req.body);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'No API key configured') {
      res.status(400).json({ error: 'No API key configured. Add one in Settings.' });
      return;
    }
    console.error('AI triage error:', err.message);
    res.status(500).json({ error: 'AI analysis failed. Check your API key and try again.' });
  }
});

router.post('/focus', async (req, res) => {
  const userId = (req as any).userId;

  if (!checkRateLimit(`focus:${userId}`)) {
    res.status(429).json({ error: 'Please wait before requesting focus suggestions' });
    return;
  }

  try {
    const result = await focusRecommendation(userId);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'No API key configured') {
      res.status(400).json({ error: 'No API key configured. Add one in Settings.' });
      return;
    }
    console.error('AI focus error:', err.message);
    res.status(500).json({ error: 'AI focus suggestion failed.' });
  }
});

router.post('/summarize', async (req, res) => {
  const userId = (req as any).userId;

  if (!checkRateLimit(`summarize:${userId}`)) {
    res.status(429).json({ error: 'Please wait before summarizing again' });
    return;
  }

  try {
    const result = await summarizePipeline(userId);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'No API key configured') {
      res.status(400).json({ error: 'No API key configured. Add one in Settings.' });
      return;
    }
    console.error('AI summarize error:', err.message);
    res.status(500).json({ error: 'AI summarization failed.' });
  }
});

export default router;
