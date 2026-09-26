'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Key, CheckCircle2, AlertTriangle, RefreshCw,
  ExternalLink, Eye, EyeOff, Save, Play, X, ShieldCheck,
  Cpu, Info, Check, AlertCircle, ArrowRight
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
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Recommended',
    description: 'Fastest response time, state-of-the-art accuracy, ideal for real-time notification drafts.',
    recommended: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: 'Deep Reasoning',
    description: 'Highest reasoning quality for nuanced, formal executive announcements.',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    badge: 'Next-Gen Flash',
    description: 'Next-generation high-speed multimodal model with great efficiency.',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    badge: 'Stable Standard',
    description: 'Dependable, fast fallback model for everyday notification checking.',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    badge: 'High Precision',
    description: 'Complex long-context reasoning with robust linguistic precision.',
  },
];

interface TestResultModalState {
  isOpen: boolean;
  success: boolean;
  title: string;
  message: string;
  details?: string;
  latencyMs?: number;
  model?: string;
}

export default function AdminAiConfigPage() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
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

  // Popup Modal State for Test Results (and Errors)
  const [testModal, setTestModal] = useState<TestResultModalState>({
    isOpen: false,
    success: false,
    title: '',
    message: '',
  });

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
        if (typeof data.temperature === 'number') setTemperature(data.temperature);
        setLastTestedAt(data.lastTestedAt || null);
        setLastTestStatus(data.lastTestStatus || null);
        setLastTestError(data.lastTestError || null);
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
      const payload: any = {
        selectedModel,
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

  // Test Run / Test Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setToastAlert(null);

    try {
      const payload: any = {
        model: selectedModel,
      };

      // If user typed a new key in the box, test with that key
      const trimmed = apiKeyInput.trim();
      if (trimmed) {
        payload.apiKey = trimmed;
      }

      const res = await api.post('/ai/test', payload);
      const data = res.data;

      // Update local state
      setLastTestStatus('success');
      setLastTestedAt(new Date().toISOString());
      setLastTestError(null);

      // Open Success Popup Modal with ✖ and OK button
      setTestModal({
        isOpen: true,
        success: true,
        title: 'Connection Successful! 🎉',
        message: data.message || `Model '${selectedModel}' connected and responded correctly.`,
        details: data.reply ? `Model Output: "${data.reply}"` : undefined,
        latencyMs: data.latencyMs,
        model: selectedModel,
      });
    } catch (err: any) {
      console.error('Test connection error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Gemini API test connection failed.';
      const errorDetails = err.response?.data?.details
        ? JSON.stringify(err.response.data.details, null, 2)
        : undefined;

      setLastTestStatus('failed');
      setLastTestedAt(new Date().toISOString());
      setLastTestError(errorMsg);

      // Open Error Popup Modal with ✖ and OK button
      setTestModal({
        isOpen: true,
        success: false,
        title: 'API Connection Failed',
        message: errorMsg,
        details: errorDetails,
        model: selectedModel,
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
            Set up your Google Gemini API key and select preferred models for intelligent notification drafting and anti-spam deliverability checking.
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
            Active Model
          </span>
          <div className="flex items-center gap-2 pt-1">
            <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {selectedModel}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Google Generative Language API
          </p>
        </div>

        {/* Last Verification Test */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 shadow-xs space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
            Last Test Status
          </span>
          <div className="flex items-center gap-2 pt-1">
            {lastTestStatus === 'success' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <Check className="w-3 h-3 stroke-[3]" /> Passed
              </span>
            ) : lastTestStatus === 'failed' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                <X className="w-3 h-3 stroke-[3]" /> Failed
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-400">
                Not tested yet
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {lastTestedAt
              ? new Date(lastTestedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Click "Test Connection" to verify'}
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

        {/* Section 2: Model Selection */}
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Select Active Gemini Model</span>
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Verified working models
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AVAILABLE_MODELS.map(m => {
              const isSelected = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModel(m.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-purple-50/80 dark:bg-purple-500/15 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white dark:bg-white/[0.02] border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {m.name}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        m.recommended
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                      }`}>
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {m.description}
                    </p>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    <span>{m.id}</span>
                    {isSelected && (
                      <span className="flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400">
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Active
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Fine Tuning Temperature */}
        <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-white/10">
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
      {/* POPUP MODAL FOR TEST RESULTS (SUCCESS / ERROR) WITH ✖ AND OK */}
      {/* ============================================================== */}
      <AnimatePresence>
        {testModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className={`p-4 sm:p-5 border-b flex items-start justify-between gap-3 ${
                testModal.success
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30'
                  : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    testModal.success
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}>
                    {testModal.success ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-base font-bold ${
                      testModal.success
                        ? 'text-emerald-900 dark:text-emerald-200'
                        : 'text-rose-900 dark:text-rose-200'
                    }`}>
                      {testModal.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Model: <span className="font-mono font-semibold">{testModal.model}</span>
                    </p>
                  </div>
                </div>

                {/* Close Icon (✖) */}
                <button
                  type="button"
                  onClick={() => setTestModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close popup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-3 text-xs">
                <div className={`p-3.5 rounded-xl border leading-relaxed ${
                  testModal.success
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-900 dark:text-rose-200'
                }`}>
                  <p className="font-semibold text-xs">{testModal.message}</p>
                  {testModal.details && (
                    <pre className="mt-2 p-2 rounded-lg bg-black/5 dark:bg-black/40 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                      {testModal.details}
                    </pre>
                  )}
                </div>

                {testModal.success ? (
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-medium px-1">
                    <span>Response Latency:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {testModal.latencyMs} ms
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1 text-slate-500 dark:text-slate-400 px-1">
                    <p className="font-bold text-slate-700 dark:text-slate-300">Troubleshooting Steps:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      <li>Verify your Google Gemini API key on Google AI Studio.</li>
                      <li>Check if your project quota or rate limit is reached.</li>
                      <li>Ensure that you copied the key completely without spaces.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Modal Footer with OK Button */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setTestModal(prev => ({ ...prev, isOpen: false }))}
                  className={`w-full sm:w-auto px-6 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer ${
                    testModal.success
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
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
