import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { ImportPreviewModal } from './ImportPreviewModal';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { useSpaces } from '../../hooks/useSpaces';
import { useTheme } from '../../hooks/useTheme';
import { useSyncStatus, useConfigureSync, useTestConnection, useTriggerSync, useTriggerPush, useTriggerPull, useDisableSync, useSyncHistory } from '../../hooks/useSync';
import { downloadExportJson, downloadDbBackup, downloadSpaceExportJson, previewImport, executeImport, restoreDatabase, getAiDefaults } from '../../lib/api';
import { Eye, EyeOff, Download, Upload, HardDriveDownload, HardDriveUpload, RefreshCw, ArrowUpFromLine, ArrowDownToLine, Unplug, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { AiProvider, ImportPreview } from '../../types';

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: spaces = [] } = useSpaces();
  const { resolvedTheme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const [inFocusLimit, setInFocusLimit] = useState(5);
  const [autoArchiveDays, setAutoArchiveDays] = useState(30);
  const [laterLimit, setLaterLimit] = useState(15);
  const [soonLimit, setSoonLimit] = useState(8);
  const [nowLimit, setNowLimit] = useState(5);
  const [aiProvider, setAiProvider] = useState<AiProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [showApiKey, setShowApiKey] = useState(false);
  const [vertexProjectId, setVertexProjectId] = useState('');
  const [vertexRegion, setVertexRegion] = useState('us-east5');
  const [detectedConfig, setDetectedConfig] = useState<{ vertexDetected: boolean; vertexProjectId: string; vertexRegion: string; model: string } | null>(null);

  // Export state
  const [exportSpaceId, setExportSpaceId] = useState('');

  // Import state
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const dbInputRef = useRef<HTMLInputElement>(null);

  // Git Sync state
  const { data: syncStatus } = useSyncStatus();
  const { data: syncHistory } = useSyncHistory();
  const configureSyncMutation = useConfigureSync();
  const testConnectionMutation = useTestConnection();
  const triggerSyncMutation = useTriggerSync();
  const triggerPushMutation = useTriggerPush();
  const triggerPullMutation = useTriggerPull();
  const disableSyncMutation = useDisableSync();
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitAuthToken, setGitAuthToken] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitSyncInterval, setGitSyncInterval] = useState(30);
  const [showGitToken, setShowGitToken] = useState(false);
  const [showSyncHistory, setShowSyncHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getAiDefaults().then(setDetectedConfig).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (settings) {
      setInFocusLimit(settings.inFocusLimit);
      setAutoArchiveDays(settings.autoArchiveDays);
      setLaterLimit(settings.horizonLimits?.later ?? 15);
      setSoonLimit(settings.horizonLimits?.soon ?? 8);
      setNowLimit(settings.horizonLimits?.now ?? 5);
      setApiKey(settings.anthropicApiKey || '');

      const hasExplicitProvider = !!settings.aiProvider;
      if (hasExplicitProvider) {
        setAiProvider(settings.aiProvider!);
        setModel(settings.anthropicModel || 'claude-sonnet-4-20250514');
        setVertexProjectId(settings.vertexProjectId || '');
        setVertexRegion(settings.vertexRegion || 'us-east5');
      } else if (detectedConfig?.vertexDetected) {
        setAiProvider('vertex');
        setModel(detectedConfig.model || settings.anthropicModel || 'claude-sonnet-4-20250514');
        setVertexProjectId(detectedConfig.vertexProjectId);
        setVertexRegion(detectedConfig.vertexRegion || 'us-east5');
      } else {
        setAiProvider('anthropic');
        setModel(settings.anthropicModel || 'claude-sonnet-4-20250514');
        setVertexProjectId('');
        setVertexRegion('us-east5');
      }
    }
  }, [settings, detectedConfig]);

  const handleSave = () => {
    updateSettings.mutate(
      {
        inFocusLimit,
        autoArchiveDays,
        horizonLimits: { later: laterLimit, soon: soonLimit, now: nowLimit },
        aiProvider,
        anthropicApiKey: apiKey || undefined,
        anthropicModel: model,
        vertexProjectId: vertexProjectId || undefined,
        vertexRegion: vertexRegion || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Settings saved');
          onClose();
        },
        onError: () => toast.error('Failed to save settings'),
      }
    );
  };

  const handleJsonFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-selected

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const preview = await previewImport(data);
      setImportData(data);
      setImportPreview(preview);
      setShowImportPreview(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to read import file');
    }
  };

  const handleImportConfirm = async (options: { importSettings: boolean }) => {
    if (!importData) return;
    setIsImporting(true);
    try {
      const result = await executeImport(importData, options);
      const parts: string[] = [];
      if (result.imported.spaces > 0) parts.push(`${result.imported.spaces} space(s)`);
      if (result.imported.items > 0) parts.push(`${result.imported.items} item(s)`);
      if (result.imported.tags > 0) parts.push(`${result.imported.tags} tag(s)`);
      toast.success(parts.length > 0 ? `Imported ${parts.join(', ')}` : 'Nothing new to import');
      setShowImportPreview(false);
      setImportData(null);
      setImportPreview(null);
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDbRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!confirm('This will replace ALL your data with the uploaded backup. A backup of your current database will be saved automatically. Continue?')) {
      return;
    }

    try {
      await restoreDatabase(file);
      toast.success('Database restored. Reloading...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(err.message || 'Restore failed');
    }
  };

  const inputClass =
    'w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors';

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="space-y-6">
        {/* Appearance */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Appearance</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                resolvedTheme === 'light'
                  ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-transparent'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                resolvedTheme === 'dark'
                  ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-transparent'
              }`}
            >
              Dark
            </button>
          </div>
        </section>

        {/* Pipeline */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Pipeline</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                In Focus limit
                <span className="ml-1 text-slate-400 font-normal">max items in focus at once</span>
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={inFocusLimit}
                onChange={(e) => setInFocusLimit(parseInt(e.target.value) || 5)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Auto-archive after
                <span className="ml-1 text-slate-400 font-normal">days in Done</span>
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={autoArchiveDays}
                onChange={(e) => setAutoArchiveDays(parseInt(e.target.value) || 30)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">
                Horizon limits
                <span className="ml-1 text-slate-400 font-normal">capacity warnings per tier</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-purple-400 mb-1">Later</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={laterLimit}
                    onChange={(e) => setLaterLimit(parseInt(e.target.value) || 15)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-1">Soon</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={soonLimit}
                    onChange={(e) => setSoonLimit(parseInt(e.target.value) || 8)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-blue-400 mb-1">Now</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={nowLimit}
                    onChange={(e) => setNowLimit(parseInt(e.target.value) || 5)}
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Warning at 70%, overloaded above limit. Backlog has no limit.
              </p>
            </div>
          </div>
        </section>

        {/* AI Integration */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">AI Integration</h3>

          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Provider</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAiProvider('anthropic')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  aiProvider === 'anthropic'
                    ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-transparent'
                }`}
              >
                Anthropic API
              </button>
              <button
                onClick={() => setAiProvider('vertex')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  aiProvider === 'vertex'
                    ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-transparent'
                }`}
              >
                Vertex AI
              </button>
            </div>
          </div>

          {aiProvider === 'anthropic' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className={inputClass + ' pr-10'}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Stored locally. Used for AI-powered triage and focus suggestions.
              </p>
            </div>
          )}

          {aiProvider === 'vertex' && (
            <div className="space-y-3">
              {detectedConfig?.vertexDetected && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-emerald-500 font-medium">
                    Auto-detected from .claude/settings.local.json
                  </span>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Google Cloud Project ID
                </label>
                <input
                  type="text"
                  value={vertexProjectId}
                  onChange={(e) => setVertexProjectId(e.target.value)}
                  placeholder={detectedConfig?.vertexProjectId || 'my-gcp-project'}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Region
                </label>
                <input
                  type="text"
                  value={vertexRegion}
                  onChange={(e) => setVertexRegion(e.target.value)}
                  placeholder={detectedConfig?.vertexRegion || 'us-east5'}
                  className={inputClass}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Uses Application Default Credentials (ADC). Run <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">gcloud auth application-default login</code> to authenticate.
              </p>
            </div>
          )}

          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputClass}
            >
              {aiProvider === 'vertex' ? (
                <>
                  <optgroup label="Claude 4.6 (latest)">
                    <option value="claude-opus-4-6@default">claude-opus-4-6@default (most capable)</option>
                    <option value="claude-sonnet-4-6@default">claude-sonnet-4-6@default (balanced)</option>
                  </optgroup>
                  <optgroup label="Claude 4.6 (pinned)">
                    <option value="claude-opus-4-6@20250610">claude-opus-4-6@20250610</option>
                    <option value="claude-sonnet-4-6@20250610">claude-sonnet-4-6@20250610</option>
                  </optgroup>
                  <optgroup label="Claude 4.5">
                    <option value="claude-haiku-4-5@20251001">claude-haiku-4-5@20251001 (fastest)</option>
                  </optgroup>
                  <optgroup label="Claude 4">
                    <option value="claude-sonnet-4@20250514">claude-sonnet-4@20250514</option>
                  </optgroup>
                </>
              ) : (
                <>
                  <optgroup label="Claude 4.6">
                    <option value="claude-opus-4-6-20250610">Claude Opus 4.6 (most capable)</option>
                    <option value="claude-sonnet-4-6-20250610">Claude Sonnet 4.6 (balanced)</option>
                  </optgroup>
                  <optgroup label="Claude 4.5">
                    <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fastest, cheapest)</option>
                  </optgroup>
                  <optgroup label="Claude 4">
                    <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (previous gen)</option>
                  </optgroup>
                </>
              )}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              {aiProvider === 'vertex'
                ? '@default always resolves to the latest version. Pinned versions are fixed.'
                : 'Opus is the most capable but costs more. Haiku is fast and cheap for simple triage.'}
            </p>
          </div>
        </section>

        {/* Export */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Export</h3>
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  downloadExportJson()
                    .then(() => toast.success('Export downloaded'))
                    .catch(() => toast.error('Export failed'));
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent transition-colors"
              >
                <Download size={14} />
                Export All (JSON)
              </button>
              <button
                onClick={() => {
                  downloadDbBackup()
                    .then(() => toast.success('Backup downloaded'))
                    .catch(() => toast.error('Backup failed'));
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent transition-colors"
              >
                <HardDriveDownload size={14} />
                Backup Database
              </button>
            </div>
            {spaces.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={exportSpaceId}
                  onChange={(e) => setExportSpaceId(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">Select a space...</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!exportSpaceId) { toast.error('Select a space first'); return; }
                    const space = spaces.find((s) => s.id === exportSpaceId);
                    downloadSpaceExportJson(exportSpaceId, space?.name || 'space')
                      .then(() => toast.success('Space export downloaded'))
                      .catch(() => toast.error('Export failed'));
                  }}
                  disabled={!exportSpaceId}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent transition-colors disabled:opacity-50"
                >
                  <Download size={14} />
                  Export Space
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Git Sync */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Git Sync</h3>

          {syncStatus?.configured && syncStatus?.enabled ? (
            <div className="space-y-3">
              {/* Status indicator */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                syncStatus.lastSyncStatus === 'error'
                  ? 'bg-red-500/10 border-red-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/20'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  syncStatus.isSyncing ? 'bg-blue-400 animate-pulse'
                  : syncStatus.lastSyncStatus === 'error' ? 'bg-red-400'
                  : 'bg-emerald-400'
                }`} />
                <span className={`text-xs font-medium ${
                  syncStatus.lastSyncStatus === 'error' ? 'text-red-500' : 'text-emerald-500'
                }`}>
                  {syncStatus.isSyncing ? 'Syncing...'
                    : syncStatus.lastSyncAt
                      ? `Last synced ${formatTimeAgo(syncStatus.lastSyncAt)}`
                      : 'Connected — not yet synced'}
                </span>
              </div>

              {syncStatus.lastError && (
                <p className="text-[10px] text-red-400 px-1">{syncStatus.lastError}</p>
              )}

              {/* Repo info */}
              <div className="text-xs text-slate-500 space-y-0.5 px-1">
                <div className="truncate">{syncStatus.repoUrl}</div>
                <div>Branch: {syncStatus.branch} &middot; Every {syncStatus.syncInterval}m</div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    triggerSyncMutation.mutate(undefined, {
                      onSuccess: (r: any) => {
                        if (r.status === 'success') toast.success('Sync complete');
                        else toast.error(r.errorMessage || 'Sync failed');
                      },
                      onError: () => toast.error('Sync failed'),
                    });
                  }}
                  disabled={triggerSyncMutation.isPending || syncStatus.isSyncing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} className={triggerSyncMutation.isPending ? 'animate-spin' : ''} />
                  Sync Now
                </button>
                <button
                  onClick={() => {
                    triggerPushMutation.mutate(undefined, {
                      onSuccess: () => toast.success('Push complete'),
                      onError: () => toast.error('Push failed'),
                    });
                  }}
                  disabled={triggerPushMutation.isPending || syncStatus.isSyncing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent transition-colors disabled:opacity-50"
                >
                  <ArrowUpFromLine size={13} />
                  Push
                </button>
                <button
                  onClick={() => {
                    triggerPullMutation.mutate(undefined, {
                      onSuccess: () => toast.success('Pull complete'),
                      onError: () => toast.error('Pull failed'),
                    });
                  }}
                  disabled={triggerPullMutation.isPending || syncStatus.isSyncing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent transition-colors disabled:opacity-50"
                >
                  <ArrowDownToLine size={13} />
                  Pull
                </button>
              </div>

              {/* History toggle */}
              {syncHistory && syncHistory.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowSyncHistory(!showSyncHistory)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showSyncHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    Recent history
                  </button>
                  {showSyncHistory && (
                    <div className="mt-2 space-y-1">
                      {syncHistory.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 text-[11px] text-slate-500 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800/50">
                          {entry.status === 'success' ? <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" /> : <XCircle size={11} className="text-red-400 flex-shrink-0" />}
                          <span className="capitalize">{entry.direction}</span>
                          <span className="text-slate-400">&middot;</span>
                          <span>{formatTimeAgo(entry.started_at)}</span>
                          {entry.items_created + entry.items_updated + entry.items_deleted > 0 && (
                            <>
                              <span className="text-slate-400">&middot;</span>
                              <span className="text-slate-400">
                                {[
                                  entry.items_created > 0 && `+${entry.items_created}`,
                                  entry.items_updated > 0 && `~${entry.items_updated}`,
                                  entry.items_deleted > 0 && `-${entry.items_deleted}`,
                                ].filter(Boolean).join(' ')}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Disconnect */}
              <button
                onClick={() => {
                  if (!confirm('Disconnect git sync? Your data will not be deleted.')) return;
                  disableSyncMutation.mutate(undefined, {
                    onSuccess: () => toast.success('Git sync disconnected'),
                    onError: () => toast.error('Failed to disconnect'),
                  });
                }}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-500 transition-colors"
              >
                <Unplug size={12} />
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Repository URL</label>
                <input
                  type="text"
                  value={gitRepoUrl}
                  onChange={(e) => setGitRepoUrl(e.target.value)}
                  placeholder="https://github.com/you/sift-data.git"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Personal Access Token</label>
                <div className="relative">
                  <input
                    type={showGitToken ? 'text' : 'password'}
                    value={gitAuthToken}
                    onChange={(e) => setGitAuthToken(e.target.value)}
                    placeholder="ghp_..."
                    className={inputClass + ' pr-10'}
                  />
                  <button
                    onClick={() => setShowGitToken(!showGitToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showGitToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Branch</label>
                  <input
                    type="text"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sync every (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={gitSyncInterval}
                    onChange={(e) => setGitSyncInterval(parseInt(e.target.value) || 30)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!gitRepoUrl || !gitAuthToken) { toast.error('Fill in repo URL and token'); return; }
                    testConnectionMutation.mutate({ repoUrl: gitRepoUrl, authToken: gitAuthToken }, {
                      onSuccess: (r) => {
                        if (r.success) toast.success('Connection successful');
                        else toast.error(r.message);
                      },
                      onError: () => toast.error('Connection test failed'),
                    });
                  }}
                  disabled={testConnectionMutation.isPending}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent transition-colors disabled:opacity-50"
                >
                  {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={() => {
                    if (!gitRepoUrl || !gitAuthToken) { toast.error('Fill in repo URL and token'); return; }
                    configureSyncMutation.mutate({
                      repoUrl: gitRepoUrl,
                      authToken: gitAuthToken,
                      branch: gitBranch,
                      syncInterval: gitSyncInterval,
                    }, {
                      onSuccess: () => toast.success('Git sync enabled'),
                      onError: (err) => toast.error(err.message || 'Failed to enable sync'),
                    });
                  }}
                  disabled={configureSyncMutation.isPending}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                >
                  {configureSyncMutation.isPending ? 'Connecting...' : 'Enable Sync'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Backs up your data as markdown files to a GitHub repo. Syncs between multiple Sift instances.
              </p>
            </div>
          )}
        </section>

        {/* Import */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Import</h3>
          <div className="flex gap-2">
            <input ref={jsonInputRef} type="file" accept=".json" className="hidden" onChange={handleJsonFileSelect} />
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent transition-colors"
            >
              <Upload size={14} />
              Import JSON
            </button>
            <input ref={dbInputRef} type="file" accept=".db" className="hidden" onChange={handleDbRestore} />
            <button
              onClick={() => dbInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent transition-colors"
            >
              <HardDriveUpload size={14} />
              Restore Database
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Import JSON merges data with duplicate prevention. Restore Database replaces everything.
          </p>
        </section>

        {/* Save */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>

    <ImportPreviewModal
      isOpen={showImportPreview}
      onClose={() => { setShowImportPreview(false); setImportData(null); setImportPreview(null); }}
      preview={importPreview}
      onConfirm={handleImportConfirm}
      isImporting={isImporting}
    />
    </>
  );
}
