'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Key, CheckCircle2, AlertTriangle, RefreshCw,
  ExternalLink, Eye, EyeOff, Save, Play, X, ShieldCheck,
  Cpu, Info, Check, AlertCircle, ArrowRight, Zap, Shield, Plus, ChevronDown
} from 'lucide-react';
import api from '@/lib/api';

interface ModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  recommended?: boolean;
}

const AVAILABLE_MODELS: ModelOption[] = [
  // ── Gemini 3.x Series ──────────────────────────────────────
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Latest & Best',
    description: 'Newest Gemini Flash model — highest intelligence, ultra-fast. Best for email drafting & notifications.',
    recommended: true,
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Agentic',
    description: 'Excellent for multi-step reasoning and complex notification workflows.',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Balanced',
    description: 'Balanced speed and capability for general notification drafting.',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'High Throughput',
    description: 'Fast and reliable for high-volume notification generation tasks.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    badge: 'Ultra Fast',
    description: 'Lightweight 3.5 model — lowest latency in the 3.x series.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Lightweight',
    description: 'Compact and fast — great general-purpose fallback model.',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    badge: 'Preview',
    description: 'Base Gemini 3 Flash preview — stable foundation model.',
  },
  // ── Gemini 2.5 Series ──────────────────────────────────────
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Stable',
    description: 'Highly stable and widely available — reliable fallback option.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    badge: 'Cost Effective',
    description: 'Lightweight 2.5 model — very fast and cost-efficient.',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: 'Pro Quality',
    description: 'Highest quality output in the 2.5 series — use for polish & refinement tasks.',
  },
  // ── Stable Aliases ─────────────────────────────────────────
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash (Latest Alias)',
    badge: 'Auto-Updated',
    description: 'Always points to the latest stable Flash model — auto-updates as Google releases new versions.',
  },
  {
    id: 'gemini-flash-lite-latest',
    name: 'Gemini Flash Lite (Latest Alias)',
    badge: 'Auto-Updated',
    description: 'Always points to the latest Flash Lite model — lightest and fastest available.',
  },
  {
    id: 'gemini-pro-latest',
    name: 'Gemini Pro (Latest Alias)',
    badge: 'Auto-Updated',
    description: 'Always points to the latest Pro-tier model for maximum quality output.',
  },
];

interface ModelTestResult {
  model: string;
  isPrimary: boolean;
  status: 'success' | 'failed';
  latencyMs?: number;
  reply?: string;
  error?: string;
  httpStatus?: number;
}

interface TestResultModalState {
  isOpen: boolean;
  success: boolean;
  title: string;
  message: string;
  primaryModel?: string;
  workingCount?: number;
  failedCount?: number;
  totalTested?: number;
  modelResults?: ModelTestResult[];
  latencyMs?: number;
}

export default function AdminAiConfigPage() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [customModelInput, setCustomModelInput] = useState('');
  const [showCustomModelBox, setShowCustomModelBox] = useState(false);
  const [enableAutoFallback, setEnableAutoFallback] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [showKey, setShowKey] = useState(false);

  // Status & Telemetry
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [lastTestStatus, setLastTestStatus] = useState<'success' | 'failed' | null>(null);
  const [lastTestError, setLastTestError] = useState<string | null>(null);

  // Loading states
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Popup Modal State for Test Results
  const [testModal, setTestModal] = useState<TestResultModalState>({
    isOpen: false,
    success: false,
    title: '',
    message: '',
  });
  const [modelResults, setModelResults] = useState<ModelTestResult[]>([]);

  // Inline toast / banner alert
  const [toastAlert, setToastAlert] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Fetch current config
  const fetchConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const res = await api.get('/ai/config');
      const data = res.data;
      if (data) {
        setHasExistingKey(!!data.hasKey);
        setMaskedKey(data.maskedKey || '');
        if (data.selectedModel) setSelectedModel(data.selectedModel);
        if (data.enableAutoFallback !== undefined) setEnableAutoFallback(Boolean(data.enableAutoFallback));
        if (typeof data.temperature === 'number') setTemperature(data.temperature);
        setLastTestedAt(data.lastTestedAt || null);
        setLastTestStatus(data.lastTestStatus || null);
        setLastTestError(data.lastTestError || null);

        // Check if selected model is custom (not in predefined list)
        const isStandard = AVAILABLE_MODELS.some(m => m.id === data.selectedModel);
        if (!isStandard && data.selectedModel) {
          setShowCustomModelBox(true);
          setCustomModelInput(data.selectedModel);
        }
      }
    } catch (err: any) {
      console.error('Failed to load AI config:', err);
      setToastAlert({
        type: 'error',
        text: 'Could not fetch current AI settings from server.',
      });
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Save Config
  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSaving(true);
    setToastAlert(null);

    try {
      const finalModel = showCustomModelBox && customModelInput.trim()
        ? customModelInput.trim()
        : selectedModel;

      const payload: any = {
        selectedModel: finalModel,
        enableAutoFallback,
        temperature,
      };

      // Only pass apiKey if admin typed something new
      const trimmed = apiKeyInput.trim();
      if (trimmed) {
        payload.apiKey = trimmed;
      }

      const res = await api.put('/ai/config', payload);
      setToastAlert({
        type: 'success',
        text: res.data?.message || 'AI settings saved successfully!',
      });
      setHasExistingKey(!!res.data?.hasKey);
      setMaskedKey(res.data?.maskedKey || '');
      setSelectedModel(finalModel);
      setApiKeyInput(''); // Clear plain text input once saved
    } catch (err: any) {
      console.error('Save failed:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to save AI configuration.';
      setToastAlert({
        type: 'error',
        text: msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Test Run — tests primary model + all fallback models
  const handleTestConnection = async () => {
    setIsTesting(true);
    setToastAlert(null);

    const testTargetModel = showCustomModelBox && customModelInput.trim()
      ? customModelInput.trim()
      : selectedModel;

    try {
      const payload: any = { model: testTargetModel };
      const trimmed = apiKeyInput.trim();
      if (trimmed) payload.apiKey = trimmed;

      const res = await api.post('/ai/test', payload);
      const data = res.data;

      const results: ModelTestResult[] = data.modelResults || [];
      setModelResults(results);

      const isPrimaryOk = data.primaryStatus === 'success';
      setLastTestStatus(isPrimaryOk ? 'success' : 'failed');
      setLastTestedAt(new Date().toISOString());
      setLastTestError(isPrimaryOk ? null : (data.primaryError || 'Primary model failed'));

      setTestModal({
        isOpen: true,
        success: isPrimaryOk || (data.workingCount > 0),
        title: isPrimaryOk
          ? `Connection Successful! 🎉`
          : `Primary Failed — ${data.workingCount} Fallback(s) Available`,
        message: data.message || '',
        primaryModel: data.primaryModel,
        workingCount: data.workingCount,
        failedCount: data.failedCount,
        totalTested: data.totalTested,
        latencyMs: data.primaryLatencyMs,
        modelResults: results,
      });
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Gemini API test failed.';
      setLastTestStatus('failed');
      setLastTestedAt(new Date().toISOString());
      setLastTestError(errorMsg);
      setModelResults([]);
      setTestModal({
        isOpen: true,
        success: false,
        title: 'API Connection Failed',
        message: errorMsg,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Google Gemini Powered
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              Smart Email & Notification Assistant
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            AI API Configuration
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 mt-1">
            Set up your Google Gemini API key, choose your default model, and enable automatic fallback for uninterrupted notification drafting.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchConfig}
          disabled={isLoadingConfig}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingConfig ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Toast Alert Banner */}
      {toastAlert && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold shadow-xs ${
            toastAlert.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{toastAlert.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastAlert(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}

      {/* Status Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Box */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 shadow-xs space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
            API Key Status
          </span>
          <div className="flex items-center gap-2 pt-1">
            {hasExistingKey ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  Key Configured
                </span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  Key Missing
                </span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
            {hasExistingKey ? maskedKey : 'Enter your Gemini key below'}
          </p>
        </div>

        {/* Active Model Box */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 shadow-xs space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
            Default Active Model
          </span>
          <div className="flex items-center gap-2 pt-1">
            <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {showCustomModelBox && customModelInput.trim() ? customModelInput.trim() : selectedModel}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Primary default model</span>
          </p>
        </div>

        {/* Fallback Protection Box */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 shadow-xs space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
            Auto-Fallback Protection
          </span>
          <div className="flex items-center gap-2 pt-1">
            {enableAutoFallback ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                Disabled
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {enableAutoFallback ? 'Auto-shifts if primary model is busy' : 'Strict single-model mode'}
          </p>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSave} className="bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
        {/* Section 1: API Key */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Google Gemini API Key</span>
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
            >
              <span>Get Free Gemini Key on Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder={hasExistingKey ? `Current Key: ${maskedKey} (Type new key to update)` : 'Paste your API key here (AIzaSy...)'}
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              className="w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#121626] text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all shadow-xs"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title={showKey ? 'Hide Key' : 'Show Key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Your key is stored securely in the encrypted backend database and never exposed to public users.</span>
          </p>
        </div>

        {/* Section 2: Model Selection & Default Choice */}
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Select Default Gemini Model</span>
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Admin ka set kiya hua model default use hoga
            </span>
          </div>

          {/* Compact Dropdown Selector */}
          <div className="space-y-3">
            <div className="relative">
              <select
                value={showCustomModelBox ? '__custom__' : selectedModel}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '__custom__') {
                    setShowCustomModelBox(true);
                  } else {
                    setShowCustomModelBox(false);
                    setSelectedModel(val);
                  }
                }}
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#121626] text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-xs appearance-none cursor-pointer transition-all hover:border-slate-400 dark:hover:border-white/25"
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id} className="dark:bg-[#121626] py-2 font-medium">
                    {m.name}
                  </option>
                ))}
                {!AVAILABLE_MODELS.some(m => m.id === selectedModel) && selectedModel && selectedModel !== '__custom__' && (
                  <option value={selectedModel} className="dark:bg-[#121626] py-2 font-medium">
                    Custom: {selectedModel}
                  </option>
                )}
                <option value="__custom__" className="dark:bg-[#121626] py-2 font-medium">
                  Custom Model...
                </option>
              </select>

              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* Compact Active Model Information Card */}
            {(() => {
              const activeModel = AVAILABLE_MODELS.find(m => m.id === selectedModel);
              if (!showCustomModelBox && activeModel) {
                return (
                  <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-500/25 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-transparent dark:from-purple-950/20 dark:via-indigo-950/10 dark:to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {activeModel.name}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          activeModel.recommended
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                            : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30'
                        }`}>
                          {activeModel.badge}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          ({activeModel.id})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {activeModel.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400 shrink-0 bg-white/80 dark:bg-white/10 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-white/10 self-start sm:self-auto">
                      <Check className="w-3.5 h-3.5 stroke-[3] text-purple-600 dark:text-purple-400" />
                      <span>Active Default</span>
                    </div>
                  </div>
                );
              } else if (!showCustomModelBox && selectedModel) {
                return (
                  <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-500/25 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-transparent dark:from-purple-950/20 dark:via-indigo-950/10 dark:to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          Custom Model
                        </span>
                        <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-bold">
                          {selectedModel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        User-defined Google Gemini API model identifier.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400 shrink-0 bg-white/80 dark:bg-white/10 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-white/10 self-start sm:self-auto">
                      <Check className="w-3.5 h-3.5 stroke-[3] text-purple-600 dark:text-purple-400" />
                      <span>Active Default</span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Custom Model Option Box */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowCustomModelBox(!showCustomModelBox)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showCustomModelBox ? 'Close Custom Model input' : 'Specify Custom / Future Gemini Model ID'}</span>
            </button>

            {showCustomModelBox && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2.5 p-3.5 rounded-xl border border-purple-300 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20 space-y-2"
              >
                <label className="block text-xs font-bold text-slate-900 dark:text-white">
                  Custom Model Name or Identifier:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. gemini-2.0-pro-exp-02-05 or gemini-3.0"
                    value={customModelInput}
                    onChange={e => setCustomModelInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-black/30 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customModelInput.trim()) {
                        setSelectedModel(customModelInput.trim());
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Set as Default
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Google Generative Language API endpoint par support hone wala koi bhi model name enter kar sakte hain.
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Section 3: Automatic Fallback Feature Checkbox */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] space-y-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setEnableAutoFallback(!enableAutoFallback)}
              className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                enableAutoFallback
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'border-slate-400 bg-white dark:bg-white/5'
              }`}
            >
              {enableAutoFallback && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white cursor-pointer" onClick={() => setEnableAutoFallback(!enableAutoFallback)}>
                  Enable Automatic Smart Model Fallback (Zero Downtime)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
                Agar aapka default selected model temporarily busy, rate-limited (429), ya unavailable ho, to Gemini AI <strong>automatic doosre working model</strong> par switch ho kar notification generate kar dega taaki aapka kaam kabhi na ruke.
              </p>
              <div className="pt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Fallback Sequence: {selectedModel} ➔ gemini-3.7-flash ➔ gemini-3.5-flash ➔ gemini-2.5-flash ➔ gemini-flash-latest</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Fine Tuning Temperature */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Creativity & Precision (Temperature):</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                {temperature.toFixed(2)}
              </span>
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {temperature <= 0.4 ? 'Strict & Deterministic' : temperature <= 0.8 ? 'Balanced (Recommended)' : 'High Creative Variation'}
            </span>
          </div>

          <input
            type="range"
            min="0.1"
            max="1.2"
            step="0.05"
            value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-purple-600 cursor-pointer"
          />
        </div>

        {/* Actions Bar */}
        <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || (!hasExistingKey && !apiKeyInput.trim())}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-purple-800 dark:text-purple-300 font-bold text-xs transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Test Connection</span>
                </>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ============================================================== */}
      {/* POPUP MODAL FOR TEST RESULTS — FULL MODEL HEALTH REPORT        */}
      {/* ============================================================== */}
      <AnimatePresence>
        {testModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className={`p-4 sm:p-5 border-b flex items-start justify-between gap-3 shrink-0 ${
                testModal.success
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30'
                  : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    testModal.success ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  }`}>
                    {testModal.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className={`text-base font-bold ${
                      testModal.success ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-900 dark:text-rose-200'
                    }`}>
                      {testModal.title}
                    </h3>
                    {/* Working / Failed summary badges */}
                    {testModal.totalTested != null && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          ✅ {testModal.workingCount} working
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                          ❌ {testModal.failedCount} failed
                        </span>
                        <span className="text-[10px] text-slate-400">/ {testModal.totalTested} tested</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTestModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body — scrollable */}
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {/* Summary message */}
                <p className={`text-xs font-semibold px-1 ${
                  testModal.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                }`}>
                  {testModal.message}
                </p>

                {/* Per-model results table */}
                {testModal.modelResults && testModal.modelResults.length > 0 && (
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_70px_70px] gap-0 bg-slate-100 dark:bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <span>Model</span>
                      <span className="text-center">Status</span>
                      <span className="text-right">Latency</span>
                    </div>

                    {/* Table rows */}
                    {testModal.modelResults.map((r, idx) => (
                      <div
                        key={r.model}
                        className={`grid grid-cols-[1fr_70px_70px] gap-0 px-3 py-2.5 text-xs border-t border-slate-100 dark:border-white/5 ${
                          r.isPrimary
                            ? 'bg-purple-50/60 dark:bg-purple-950/20'
                            : idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-white/[0.02]'
                        }`}
                      >
                        {/* Model name + Primary badge */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {r.model}
                            </span>
                            {r.isPrimary && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                Primary
                              </span>
                            )}
                          </div>
                          {/* Error message if failed */}
                          {r.status === 'failed' && r.error && (
                            <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-0.5 leading-tight line-clamp-2">
                              {r.error}
                            </p>
                          )}
                        </div>

                        {/* Status badge */}
                        <div className="flex items-start justify-center pt-0.5">
                          {r.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                              <AlertTriangle className="w-3 h-3" /> Fail
                            </span>
                          )}
                        </div>

                        {/* Latency */}
                        <div className="flex items-start justify-end pt-0.5">
                          <span className={`font-mono text-[11px] font-bold ${
                            r.status === 'success'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}>
                            {r.latencyMs != null ? `${r.latencyMs}ms` : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* No results fallback */}
                {(!testModal.modelResults || testModal.modelResults.length === 0) && !testModal.success && (
                  <div className="p-3.5 rounded-xl border bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-900 dark:text-rose-200 text-xs">
                    <p className="font-semibold">Troubleshooting Tips:</p>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
                      <li>Verify your Gemini API key on Google AI Studio.</li>
                      <li>Check if your project quota or rate limit is reached.</li>
                      <li>Ensure the key is complete without extra spaces.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setTestModal(prev => ({ ...prev, isOpen: false }))}
                  className={`w-full sm:w-auto px-6 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer ${
                    testModal.success ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

