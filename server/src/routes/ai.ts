import { Router } from 'express';
import { triageItems, focusRecommendation, summarizePipeline, prepareTriageRequest, parseTriageResponse, SYSTEM_PROMPT } from '../services/ai.js';

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
    if (err.message === 'No API key configured' || err.message?.includes('Vertex AI requires')) {
      res.status(400).json({ error: err.message + ' Configure AI in Settings.' });
      return;
    }
    console.error('AI triage error:', err.message);
    res.status(500).json({ error: 'AI analysis failed. Check your configuration and try again.' });
  }
});

router.post('/triage/stream', async (req, res) => {
  const userId = (req as any).userId;

  if (!checkRateLimit(`triage:${userId}`)) {
    res.status(429).json({ error: 'Please wait before analyzing again' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { client, model, allItems, userMessage } = prepareTriageRequest(userId, req.body);

    if (allItems.length === 0) {
      send({ type: 'result', recommendations: [] });
      send({ type: 'done' });
      res.end();
      return;
    }

    send({ type: 'status', message: `Using ${model}` });

    const enableThinking = !model.includes('haiku');
    const params: any = {
      model,
      max_tokens: enableThinking ? 16000 : 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      stream: true,
    };
    if (enableThinking) {
      params.thinking = { type: 'enabled', budget_tokens: 10000 };
    }

    let responseText = '';
    let currentBlockType: string | null = null;

    const stream = await (client.messages as any).create(params);

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        currentBlockType = event.content_block?.type || null;
        if (currentBlockType === 'thinking') {
          send({ type: 'phase', phase: 'thinking' });
        } else if (currentBlockType === 'text') {
          send({ type: 'phase', phase: 'responding' });
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta?.type === 'thinking_delta') {
          send({ type: 'thinking', content: event.delta.thinking });
        } else if (event.delta?.type === 'text_delta') {
          responseText += event.delta.text;
          send({ type: 'text', content: event.delta.text });
        }
      }
    }

    const recommendations = parseTriageResponse(responseText);
    send({ type: 'result', recommendations });
    send({ type: 'done' });
  } catch (err: any) {
    send({ type: 'error', message: err.message || 'AI analysis failed' });
  }

  res.end();
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
    if (err.message === 'No API key configured' || err.message?.includes('Vertex AI requires')) {
      res.status(400).json({ error: err.message + ' Configure AI in Settings.' });
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
    if (err.message === 'No API key configured' || err.message?.includes('Vertex AI requires')) {
      res.status(400).json({ error: err.message + ' Configure AI in Settings.' });
      return;
    }
    console.error('AI summarize error:', err.message);
    res.status(500).json({ error: 'AI summarization failed.' });
  }
});

export default router;
