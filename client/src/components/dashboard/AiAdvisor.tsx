import { useState, useRef, useEffect } from 'react';
import { Zap, Loader2, AlertTriangle, Check, X, CheckCircle2, ChevronDown, ChevronRight, Brain, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { useSettings } from '../../hooks/useSettings';
import { useMoveItem, useUpdateItem } from '../../hooks/useItems';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getAiDefaults } from '../../lib/api';
import type { Horizon } from '../../types';

interface AiAdvisorProps {
  overdue: any[];
  staleBacklog: any[];
  needsAttention: any[];
  dueSoon: any[];
}

interface AiRecommendation {
  id: string;
  itemId: string;
  itemTitle: string;
  action: string;
  reason: string;
  suggestedHorizon?: Horizon;
  suggestedPriority?: number;
  applied?: boolean;
  dismissed?: boolean;
}

export function AiAdvisor({ overdue, staleBacklog, needsAttention, dueSoon }: AiAdvisorProps) {
  const { data: settings } = useSettings();
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const moveItem = useMoveItem();
  const updateItem = useUpdateItem();
  const qc = useQueryClient();

  const [thinkingText, setThinkingText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'thinking' | 'responding' | 'done'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [showLog, setShowLog] = useState(false);
  const [streamError, setStreamError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  const { data: aiDefaults } = useQuery({ queryKey: ['ai-defaults'], queryFn: getAiDefaults, staleTime: Infinity });
  const hasAiConfigured = settings?.aiProvider === 'vertex' || !!settings?.anthropicApiKey || !!aiDefaults?.vertexDetected;

  useEffect(() => {
    if (logRef.current && (currentPhase === 'thinking' || currentPhase === 'responding')) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [thinkingText, responseText, currentPhase]);

  const buildLocalRecommendations = (): AiRecommendation[] => {
    const recs: AiRecommendation[] = [];
    let id = 0;

    overdue.forEach((item: any) => {
      recs.push({
        id: `rec-${id++}`,
        itemId: item.id,
        itemTitle: item.title,
        action: 'Move to Now',
        reason: `Overdue by ${Math.abs(Math.floor((new Date(item.due_date + 'T00:00:00').getTime() - new Date().getTime()) / 86400000))} days \u2014 needs immediate attention`,
        suggestedHorizon: 'now',
      });
    });

    staleBacklog.forEach((item: any) => {
      const daysOld = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000);
      recs.push({
        id: `rec-${id++}`,
        itemId: item.id,
        itemTitle: item.title,
        action: 'Move to Later or Soon',
        reason: `Sitting in Backlog for ${daysOld} days \u2014 triage it or commit to a horizon`,
        suggestedHorizon: 'later',
      });
    });

    needsAttention.forEach((item: any) => {
      const missing = [];
      if (item.priority === 0) missing.push('priority');
      if (!item.effort) missing.push('effort estimate');
      const horizonLabel = item.horizon === 'now' ? 'Now' : item.horizon === 'soon' ? 'Soon' : 'Later';
      recs.push({
        id: `rec-${id++}`,
        itemId: item.id,
        itemTitle: item.title,
        action: `Add ${missing.join(' and ')}`,
        reason: `In ${horizonLabel} without ${missing.join('/')} \u2014 harder to prioritize`,
        suggestedPriority: item.priority === 0 ? 2 : undefined,
      });
    });

    return recs;
  };

  const analyzeWithAi = async () => {
    if (!hasAiConfigured) {
      setRecommendations(buildLocalRecommendations());
      setHasRun(true);
      return;
    }

    setIsAnalyzing(true);
    setThinkingText('');
    setResponseText('');
    setStreamError('');
    setCurrentPhase('idle');
    setStatusMessage('');
    setShowLog(true);

    try {
      const res = await fetch('/api/ai/triage/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overdue, staleBacklog, needsAttention, dueSoon }),
      });

      if (res.status === 429) {
        toast.error('Please wait a moment before analyzing again');
        setIsAnalyzing(false);
        setShowLog(false);
        return;
      }

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'AI analysis failed');
        setRecommendations(buildLocalRecommendations());
        setHasRun(true);
        setIsAnalyzing(false);
        setShowLog(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            switch (event.type) {
              case 'status':
                setStatusMessage(event.message);
                break;
              case 'phase':
                setCurrentPhase(event.phase);
                break;
              case 'thinking':
                setThinkingText((prev) => prev + event.content);
                break;
              case 'text':
                setResponseText((prev) => prev + event.content);
                break;
              case 'result':
                setRecommendations(event.recommendations || []);
                setHasRun(true);
                setCurrentPhase('done');
                break;
              case 'error':
                setStreamError(event.message);
                setRecommendations(buildLocalRecommendations());
                setHasRun(true);
                setCurrentPhase('done');
                break;
              case 'done':
                break;
            }
          } catch {}
        }
      }
    } catch {
      setRecommendations(buildLocalRecommendations());
      setHasRun(true);
      setCurrentPhase('done');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyRecommendation = async (rec: AiRecommendation) => {
    try {
      if (rec.suggestedHorizon) {
        await moveItem.mutateAsync({ id: rec.itemId, horizon: rec.suggestedHorizon });
      }
      if (rec.suggestedPriority !== undefined) {
        await updateItem.mutateAsync({ id: rec.itemId, priority: rec.suggestedPriority as any });
      }

      setRecommendations((prev) =>
        prev.map((r) => (r.id === rec.id ? { ...r, applied: true } : r))
      );
      toast.success(`Applied: ${rec.action}`);
      qc.invalidateQueries({ queryKey: ['stats'] });
    } catch {
      toast.error('Failed to apply recommendation');
    }
  };

  const dismissRecommendation = (recId: string) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === recId ? { ...r, dismissed: true } : r))
    );
  };

  const activeRecs = recommendations.filter((r) => !r.applied && !r.dismissed);
  const hasIssues = overdue.length > 0 || staleBacklog.length > 0 || needsAttention.length > 0;
  const hasLogContent = thinkingText || responseText || streamError;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          Focus Advisor
          {!hasAiConfigured && (
            <span className="text-[10px] font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              Rules-based (configure AI in Settings)
            </span>
          )}
        </h3>
        <button
          onClick={analyzeWithAi}
          disabled={isAnalyzing || !hasIssues}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            hasIssues
              ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
          )}
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {currentPhase === 'thinking' ? 'Thinking...' : currentPhase === 'responding' ? 'Responding...' : 'Connecting...'}
            </>
          ) : (
            <>
              <Zap size={14} />
              {hasRun ? 'Re-analyze' : 'Analyze & Recommend'}
            </>
          )}
        </button>
      </div>

      {/* AI Log Panel */}
      {hasLogContent && (
        <div className="mb-4">
          <button
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mb-2"
          >
            {showLog ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            AI Log
            {statusMessage && (
              <span className="font-normal text-slate-400 ml-1">({statusMessage})</span>
            )}
          </button>

          {showLog && (
            <div
              ref={logRef}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 max-h-72 overflow-y-auto font-mono text-xs"
            >
              {thinkingText && (
                <div className="border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/5 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <Brain size={12} className="text-purple-400" />
                    <span className="text-purple-400 font-semibold">Thinking</span>
                    {currentPhase === 'thinking' && (
                      <Loader2 size={10} className="animate-spin text-purple-400 ml-auto" />
                    )}
                  </div>
                  <pre className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-words leading-relaxed">
                    {thinkingText}
                  </pre>
                </div>
              )}

              {responseText && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/5 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <MessageSquare size={12} className="text-blue-400" />
                    <span className="text-blue-400 font-semibold">Response</span>
                    {currentPhase === 'responding' && (
                      <Loader2 size={10} className="animate-spin text-blue-400 ml-auto" />
                    )}
                  </div>
                  <pre className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                    {responseText}
                  </pre>
                </div>
              )}

              {streamError && (
                <div className="px-3 py-2 text-red-400">
                  Error: {streamError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!hasRun && !isAnalyzing && (
        <div className="text-center py-6">
          <p className="text-sm text-slate-400">
            {hasIssues
              ? `Found ${overdue.length + staleBacklog.length + needsAttention.length} items that could use attention. Click "Analyze & Recommend" to get suggestions.`
              : 'Everything looks clean! No recommendations right now.'}
          </p>
        </div>
      )}

      {activeRecs.length > 0 && (
        <div className="space-y-2">
          {activeRecs.map((rec) => (
            <div
              key={rec.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
            >
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{rec.itemTitle}</p>
                <p className="text-xs text-slate-400 mt-0.5">{rec.reason}</p>
                <p className="text-xs text-amber-400 font-medium mt-1">{rec.action}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => applyRecommendation(rec)}
                  className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  title="Apply"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => dismissRecommendation(rec.id)}
                  className="p-1.5 rounded-md text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasRun && activeRecs.length === 0 && !isAnalyzing && (
        <div className="text-center py-4">
          <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-slate-400">All caught up! No pending recommendations.</p>
        </div>
      )}
    </div>
  );
}
