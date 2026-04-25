import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { ImportPreviewModal } from './ImportPreviewModal';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { useSpaces } from '../../hooks/useSpaces';
import { useTheme } from '../../hooks/useTheme';
import { downloadExportJson, downloadDbBackup, downloadSpaceExportJson, previewImport, executeImport, restoreDatabase, getAiDefaults } from '../../lib/api';
import { Eye, EyeOff, Download, Upload, HardDriveDownload, HardDriveUpload } from 'lucide-react';
import type { AiProvider, ImportPreview } from '../../types';

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
