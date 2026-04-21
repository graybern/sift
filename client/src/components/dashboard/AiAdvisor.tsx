import { useState } from 'react';
import { Zap, Loader2, AlertTriangle, Check, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { useSettings } from '../../hooks/useSettings';
import { useMoveItem, useUpdateItem } from '../../hooks/useItems';
import { useQueryClient } from '@tanstack/react-query';
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

  const hasApiKey = !!settings?.anthropicApiKey;

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
    if (!hasApiKey) {
      setRecommendations(buildLocalRecommendations());
      setHasRun(true);
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overdue, staleBacklog, needsAttention, dueSoon }),
      });

      if (res.status === 501) {
        setRecommendations(buildLocalRecommendations());
        setHasRun(true);
        return;
      }

      if (res.status === 429) {
        toast.error('Please wait a moment before analyzing again');
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'AI analysis failed');
        setRecommendations(buildLocalRecommendations());
        setHasRun(true);
        return;
      }

      const data = await res.json();
      setRecommendations(data.recommendations || buildLocalRecommendations());
      setHasRun(true);
    } catch {
      setRecommendations(buildLocalRecommendations());
      setHasRun(true);
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

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          Focus Advisor
          {!hasApiKey && (
            <span className="text-[10px] font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              Rules-based (add API key in Settings for AI)
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
              {hasApiKey ? 'AI analyzing...' : 'Analyzing...'}
            </>
          ) : (
            <>
              <Zap size={14} />
              {hasRun ? 'Re-analyze' : 'Analyze & Recommend'}
            </>
          )}
        </button>
      </div>

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

      {hasRun && activeRecs.length === 0 && (
        <div className="text-center py-4">
          <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-slate-400">All caught up! No pending recommendations.</p>
        </div>
      )}
    </div>
  );
}
