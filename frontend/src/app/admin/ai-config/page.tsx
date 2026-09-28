'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Key, CheckCircle2, AlertTriangle, RefreshCw,
  Eye, EyeOff, Save, Play, X, ShieldCheck, Zap, ArrowRight,
  Settings2, Cpu, FlameKindling,
} from 'lucide-react';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelOption { id: string; name: string; badge: string; badgeColor: string; }

interface ModelTestResult {
  model: string;
  isPrimary: boolean;
  status: 'success' | 'failed';
  latencyMs?: number;
  error?: string;
}

interface TestModal {
  isOpen: boolean;
  success: boolean;
  title: string;
  message: string;
  workingCount?: number;
  failedCount?: number;
  totalTested?: number;
  latencyMs?: number;
  modelResults?: ModelTestResult[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODELS: ModelOption[] = [
  { id: 'gemini-3.8-flash',        name: 'Gemini 3.8 Flash',        badge: 'Latest',       badgeColor: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300' },
  { id: 'gemini-3.7-flash',        name: 'Gemini 3.7 Flash',        badge: 'Agentic',      badgeColor: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' },
  { id: 'gemini-3.6-flash',        name: 'Gemini 3.6 Flash',        badge: 'Balanced',     badgeColor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' },
  { id: 'gemini-3.5-flash',        name: 'Gemini 3.5 Flash',        badge: 'Fast',         badgeColor: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300' },
  { id: 'gemini-3.5-flash-lite',   name: 'Gemini 3.5 Flash Lite',   badge: 'Ultra Fast',   badgeColor: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300' },
  { id: 'gemini-3.1-flash-lite',   name: 'Gemini 3.1 Flash Lite',   badge: 'Lite',         badgeColor: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300' },
  { id: 'gemini-3-flash-preview',  name: 'Gemini 3 Flash Preview',  badge: 'Preview',      badgeColor: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' },
  { id: 'gemini-2.5-flash',        name: 'Gemini 2.5 Flash',        badge: 'Stable',       badgeColor: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
  { id: 'gemini-2.5-flash-lite',   name: 'Gemini 2.5 Flash Lite',   badge: 'Lite',         badgeColor: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300' },
  { id: 'gemini-2.5-pro',          name: 'Gemini 2.5 Pro',          badge: 'Pro',          badgeColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  { id: 'gemini-flash-latest',     name: 'Flash (Latest Alias)',    badge: 'Auto',         badgeColor: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400' },
  { id: 'gemini-flash-lite-latest',name: 'Flash Lite (Latest Alias)',badge: 'Auto',         badgeColor: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400' },
  { id: 'gemini-pro-latest',       name: 'Pro (Latest Alias)',      badge: 'Auto',         badgeColor: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400' },
];

const NVIDIA_MODELS: ModelOption[] = [
  { id: 'nvidia/nemotron-3-super-120b-a12b',   name: 'Nemotron 3 Super 120B',    badge: '⚡ Fastest 3.2s', badgeColor: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300' },
  { id: 'openai/gpt-oss-20b',                  name: 'GPT OSS 20B',               badge: '5.9s',           badgeColor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' },
  { id: 'nvidia/nemotron-3.5-lightning-30b-a3b',name: 'Nemotron 3.5 Lightning 30B',badge: '7.4s',           badgeColor: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400' },
];

const FALLBACK_CHAIN = [
  { label: '① Gemini Primary', color: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  { label: '② Gemini Auto-Fallback (10 models)', color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  { label: '③ NVIDIA NIM (last resort)', color: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminAiConfigPage() {
  // Gemini
  const [apiKeyInput, setApiKeyInput]           = useState('');
  const [maskedKey, setMaskedKey]               = useState('');
  const [hasExistingKey, setHasExistingKey]     = useState(false);
  const [showKey, setShowKey]                   = useState(false);
  const [selectedModel, setSelectedModel]       = useState('gemini-3.8-flash');
  const [customModel, setCustomModel]           = useState('');
  const [showCustom, setShowCustom]             = useState(false);
  const [enableAutoFallback, setEnableAutoFallback] = useState(true);
  const [temperature, setTemperature]           = useState(0.7);

  // NVIDIA
  const [nvidiaKeyInput, setNvidiaKeyInput]         = useState('');
  const [maskedNvidiaKey, setMaskedNvidiaKey]       = useState('');
  const [hasNvidiaKey, setHasNvidiaKey]             = useState(false);
  const [showNvidiaKey, setShowNvidiaKey]           = useState(false);
  const [enableNvidia, setEnableNvidia]             = useState(false);
  const [nvidiaModel, setNvidiaModel]               = useState('nvidia/nemotron-3-super-120b-a12b');

  // Status
  const [lastTestedAt, setLastTestedAt]         = useState<string | null>(null);
  const [lastTestStatus, setLastTestStatus]     = useState<'success' | 'failed' | null>(null);
  const [lastTestError, setLastTestError]       = useState<string | null>(null);

  // UI states
  const [isLoading, setIsLoading]   = useState(true);
  const [isSaving, setIsSaving]     = useState(false);
  const [isTesting, setIsTesting]   = useState(false);
  const [toast, setToast]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testModal, setTestModal]   = useState<TestModal>({ isOpen: false, success: false, title: '', message: '' });

  // ─── Fetch config ───────────────────────────────────────────────────────────

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/ai/config');
      setHasExistingKey(!!data.hasKey);
      setMaskedKey(data.maskedKey || '');
      if (data.selectedModel) setSelectedModel(data.selectedModel);
      if (data.enableAutoFallback !== undefined) setEnableAutoFallback(Boolean(data.enableAutoFallback));
      if (typeof data.temperature === 'number') setTemperature(data.temperature);
      setLastTestedAt(data.lastTestedAt || null);
      setLastTestStatus(data.lastTestStatus || null);
      setLastTestError(data.lastTestError || null);
      setHasNvidiaKey(!!data.hasNvidiaKey);
      setMaskedNvidiaKey(data.maskedNvidiaKey || '');
      setEnableNvidia(Boolean(data.enableNvidiaFallback));
      if (data.nvidiaModel) setNvidiaModel(data.nvidiaModel);

      const isCustom = !GEMINI_MODELS.some(m => m.id === data.selectedModel);
      if (isCustom && data.selectedModel) { setShowCustom(true); setCustomModel(data.selectedModel); }
    } catch {
      setToast({ type: 'error', text: 'Failed to load AI settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  // ─── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSaving(true);
    setToast(null);
    try {
      const finalModel = showCustom && customModel.trim() ? customModel.trim() : selectedModel;
      const payload: any = { selectedModel: finalModel, enableAutoFallback, temperature, enableNvidiaFallback: enableNvidia, nvidiaModel };
      const gKey = apiKeyInput.trim();
      if (gKey) payload.apiKey = gKey;
      const nKey = nvidiaKeyInput.trim();
      if (nKey) payload.nvidiaApiKey = nKey;

      const { data } = await api.put('/ai/config', payload);
      setToast({ type: 'success', text: data.message || 'Saved successfully!' });
      setHasExistingKey(!!data.hasKey);
      setMaskedKey(data.maskedKey || '');
      setSelectedModel(finalModel);
      setApiKeyInput('');
      if (data.hasNvidiaKey !== undefined) setHasNvidiaKey(data.hasNvidiaKey);
      if (data.maskedNvidiaKey) setMaskedNvidiaKey(data.maskedNvidiaKey);
      setNvidiaKeyInput('');
    } catch (err: any) {
      setToast({ type: 'error', text: err.response?.data?.message || 'Failed to save.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Test — primary Gemini + NVIDIA (if enabled)
  const handleTest = async () => {
    setIsTesting(true);
    setToast(null);
    const model = showCustom && customModel.trim() ? customModel.trim() : selectedModel;
    try {
      const payload: any = { model };
      if (apiKeyInput.trim()) payload.apiKey = apiKeyInput.trim();
      const { data } = await api.post('/ai/test', payload);
      const results = data.modelResults || [];
      const geminiOk = data.primaryStatus === 'success';
      setLastTestStatus(geminiOk ? 'success' : 'failed');
      setLastTestedAt(new Date().toISOString());
      setLastTestError(geminiOk ? null : data.primaryError || 'Primary failed');
      setTestModal({
        isOpen: true,
        success: data.success,
        title: geminiOk
          ? '✅ Gemini Working!'
          : data.nvidiaStatus === 'success'
            ? '⚠️ Gemini Failed — NVIDIA Ready'
            : '❌ All Failed',
        message: data.message || '',
        workingCount: data.workingCount,
        failedCount: data.failedCount,
        totalTested: data.totalTested,
        latencyMs: data.primaryLatencyMs,
        modelResults: results,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Test failed.';
      setLastTestStatus('failed');
      setLastTestedAt(new Date().toISOString());
      setLastTestError(msg);
      setTestModal({ isOpen: true, success: false, title: '❌ Connection Failed', message: msg });
    } finally {
      setIsTesting(false);
    }
  };

  // ─── UI helpers ─────────────────────────────────────────────────────────────

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button type="button" onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${value ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-white dark:bg-[#0f1623] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  );

  const SectionHeader = ({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) => (
    <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );

  const KeyField = ({
    label, hint, value, onChange, show, onToggle, placeholder,
    hasExisting, masked, accentColor = 'purple',
  }: any) => (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
        {hasExisting && (
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400`}>
            ✓ Saved: {masked}
          </span>
        )}
        {hint && <span className="text-[10px] text-slate-400 font-normal">{hint}</span>}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-${accentColor}-500/30 focus:border-${accentColor}-500/50`}
        />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }); }
    catch { return iso; }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Sparkles className="w-3 h-3" /> AI Configuration
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">AI Settings</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure Gemini API, model selection, and NVIDIA NIM fallback
          </p>
        </div>
        <button type="button" onClick={fetchConfig} disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm cursor-pointer disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold border ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
            }`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{toast.text}</span>
            </div>
            <button onClick={() => setToast(null)} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status Row ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Gemini key status */}
        <SectionCard>
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Gemini Key</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`w-2 h-2 rounded-full ${hasExistingKey ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className={`text-sm font-bold ${hasExistingKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {hasExistingKey ? 'Active' : 'Not Set'}
              </span>
            </div>
          </div>
        </SectionCard>

        {/* Last test */}
        <SectionCard>
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Last Test</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {lastTestStatus === 'success' && <><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Passed</span></>}
              {lastTestStatus === 'failed' && <><span className="w-2 h-2 rounded-full bg-rose-500" /><span className="text-sm font-bold text-rose-600 dark:text-rose-400">Failed</span></>}
              {!lastTestStatus && <span className="text-sm font-bold text-slate-400">Never</span>}
            </div>
            {lastTestedAt && <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(lastTestedAt)}</p>}
          </div>
        </SectionCard>

        {/* NVIDIA status */}
        <SectionCard>
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">NVIDIA Fallback</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`w-2 h-2 rounded-full ${enableNvidia && hasNvidiaKey ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className={`text-sm font-bold ${enableNvidia && hasNvidiaKey ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {enableNvidia && hasNvidiaKey ? 'Ready' : enableNvidia ? 'No Key' : 'Off'}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Fallback Chain Visual ── */}
      <SectionCard>
        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">3-Level Fallback Chain</p>
          <div className="flex items-center gap-2 flex-wrap">
            {FALLBACK_CHAIN.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <span className={`w-2 h-2 rounded-full ${item.dot} shrink-0`} />
                  <span className={`text-[11px] font-semibold ${item.color}`}>{item.label}</span>
                </div>
                {i < FALLBACK_CHAIN.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              </div>
            ))}
          </div>
          {!enableNvidia && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Enable NVIDIA fallback below to activate Level 3 protection
            </p>
          )}
        </div>
      </SectionCard>

      <form onSubmit={handleSave} className="space-y-5">

        {/* ── Section 1: Gemini API Key ── */}
        <SectionCard>
          <SectionHeader
            icon={<div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shrink-0"><Key className="w-4 h-4 text-white" /></div>}
            title="Gemini API Key"
            subtitle="Your Google AI Studio key — used for all email & notification drafting"
          />
          <div className="p-5 space-y-4">
            <KeyField
              label="API Key"
              hint="(from aistudio.google.com)"
              value={apiKeyInput}
              onChange={setApiKeyInput}
              show={showKey}
              onToggle={() => setShowKey(v => !v)}
              placeholder={hasExistingKey ? 'Enter new key to replace...' : 'AIzaSy...'}
              hasExisting={hasExistingKey}
              masked={maskedKey}
              accentColor="purple"
            />
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-medium">
              <Sparkles className="w-3 h-3" /> Get a free Gemini API key →
            </a>
          </div>
        </SectionCard>

        {/* ── Section 2: Model Selection ── */}
        <SectionCard>
          <SectionHeader
            icon={<div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0"><Cpu className="w-4 h-4 text-white" /></div>}
            title="Primary Gemini Model"
            subtitle="The model used first for every AI request"
          />
          <div className="p-5 space-y-4">
            {/* Model grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GEMINI_MODELS.map(m => (
                <button key={m.id} type="button"
                  onClick={() => { setSelectedModel(m.id); setShowCustom(false); }}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedModel === m.id && !showCustom
                      ? 'border-purple-400 dark:border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20'
                  }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedModel === m.id && !showCustom
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      : <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                    }
                    <span className="text-xs font-semibold text-slate-800 dark:text-white truncate font-mono">{m.id}</span>
                  </div>
                  <span className={`shrink-0 ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${m.badgeColor}`}>{m.badge}</span>
                </button>
              ))}
            </div>

            {/* Custom model toggle */}
            <div>
              <button type="button" onClick={() => setShowCustom(v => !v)}
                className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-medium cursor-pointer">
                {showCustom ? '← Use list above' : '+ Use a custom model ID'}
              </button>
              {showCustom && (
                <input value={customModel} onChange={e => setCustomModel(e.target.value)}
                  placeholder="e.g. gemini-2.0-flash-exp"
                  className="mt-2 w-full bg-slate-50 dark:bg-white/5 border border-purple-300 dark:border-purple-500/40 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30" />
              )}
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Temperature</label>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 font-mono">{temperature.toFixed(1)}</span>
              </div>
              <input type="range" min={0} max={2} step={0.1} value={temperature} onChange={e => setTemperature(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0.0 Precise</span><span>1.0 Balanced</span><span>2.0 Creative</span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── Section 3: Gemini Auto-Fallback ── */}
        <SectionCard>
          <SectionHeader
            icon={<div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0"><Zap className="w-4 h-4 text-white" /></div>}
            title="Gemini Auto-Fallback (Level 2)"
            subtitle="Automatically tries 10 backup Gemini models if primary fails"
            action={<Toggle value={enableAutoFallback} onChange={() => setEnableAutoFallback(v => !v)} />}
          />
          <div className={`px-5 pb-5 pt-3 transition-opacity ${enableAutoFallback ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="flex flex-wrap gap-1.5">
              {['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-3-flash-preview','gemini-2.5-flash','gemini-2.5-flash-lite','gemini-flash-latest'].map(m => (
                <span key={m} className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[10px] font-mono text-amber-700 dark:text-amber-400">
                  {m}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
              Sequential testing with 400ms delay to avoid rate limits. Stops as soon as one model succeeds.
            </p>
          </div>
        </SectionCard>

        {/* ── Section 4: NVIDIA NIM Fallback ── */}
        <SectionCard>
          <SectionHeader
            icon={<div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4 text-white" /></div>}
            title="NVIDIA NIM Fallback (Level 3)"
            subtitle="Last resort — activates only when ALL Gemini models fail"
            action={<Toggle value={enableNvidia} onChange={() => setEnableNvidia(v => !v)} />}
          />
          <div className={`p-5 space-y-4 transition-opacity ${enableNvidia ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <KeyField
              label="NVIDIA API Key"
              hint="(from build.nvidia.com)"
              value={nvidiaKeyInput}
              onChange={setNvidiaKeyInput}
              show={showNvidiaKey}
              onToggle={() => setShowNvidiaKey(v => !v)}
              placeholder={hasNvidiaKey ? 'Enter new key to replace...' : 'nvapi-...'}
              hasExisting={hasNvidiaKey}
              masked={maskedNvidiaKey}
              accentColor="green"
            />

            {/* NVIDIA Model selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                NVIDIA Model
                <span className="ml-2 text-[10px] font-normal text-green-600 dark:text-green-400">3 models verified working on your key</span>
              </label>
              <div className="space-y-2">
                {NVIDIA_MODELS.map(m => (
                  <button key={m.id} type="button" onClick={() => setNvidiaModel(m.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      nvidiaModel === m.id
                        ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-500/10'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20'
                    }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {nvidiaModel === m.id
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        : <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                      }
                      <span className="text-xs font-semibold text-slate-800 dark:text-white truncate font-mono">{m.id}</span>
                    </div>
                    <span className={`shrink-0 ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${m.badgeColor}`}>{m.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── Test + Save Buttons ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">

          {/* Test Button — prominent gradient */}
          <button type="button" onClick={handleTest} disabled={isTesting || !hasExistingKey}
            className="group relative inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer disabled:opacity-40 overflow-hidden"
            style={{ background: isTesting ? '#4f46e5' : 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', boxShadow: '0 4px 20px rgba(79,70,229,0.35)' }}
          >
            <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            {isTesting ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /><span>Testing...</span></>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Test Connection</span>
                <span className="text-[10px] font-normal opacity-70">
                  (Gemini{enableNvidia && hasNvidiaKey ? ' + NVIDIA' : ''})
                </span>
              </>
            )}
          </button>

          {/* Save All */}
          <button type="submit" disabled={isSaving}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 dark:bg-white/10 hover:bg-slate-700 dark:hover:bg-white/20 text-white font-bold text-sm transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 border border-white/10">
            {isSaving ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /><span>Saving...</span></>
            ) : (
              <><Save className="w-4 h-4" /><span>Save All Settings</span></>
            )}
          </button>
        </div>

        {/* Last test error */}
        {lastTestStatus === 'failed' && lastTestError && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span><strong>Last test error:</strong> {lastTestError}</span>
          </div>
        )}

      </form>

      {/* ── Test Results Modal ── */}
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
              <div className={`p-5 border-b flex items-start justify-between gap-3 shrink-0 ${
                testModal.success
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30'
                  : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30'
              }`}>
                <div>
                  <h3 className={`text-base font-bold ${testModal.success ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-900 dark:text-rose-200'}`}>
                    {testModal.title}
                  </h3>
                  {testModal.totalTested != null && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        ✅ {testModal.workingCount} working
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                        ❌ {testModal.failedCount} failed
                      </span>
                      <span className="text-[10px] text-slate-400">/ {testModal.totalTested} tested</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setTestModal(p => ({ ...p, isOpen: false }))}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body — Gemini + NVIDIA rows */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                <p className={`text-xs font-semibold ${testModal.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                  {testModal.message}
                </p>

                {testModal.modelResults && testModal.modelResults.length > 0 && (
                  <div className="space-y-2.5">
                    {testModal.modelResults.map((r: any) => (
                      <div key={r.model} className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border ${
                        r.status === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                      }`}>
                        <div className="min-w-0 flex items-start gap-2.5">
                          {/* Provider icon */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold ${
                            r.provider === 'nvidia' ? 'bg-green-500' : 'bg-purple-500'
                          }`}>
                            {r.provider === 'nvidia' ? 'NV' : 'G'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-800 dark:text-white">{r.model}</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                r.provider === 'nvidia'
                                  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                  : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                              }`}>{r.provider === 'nvidia' ? 'NVIDIA NIM' : 'Gemini Primary'}</span>
                            </div>
                            {r.status === 'failed' && r.error && (
                              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 line-clamp-2">{r.error}</p>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`block text-xs font-bold ${
                            r.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {r.status === 'success' ? '✅ OK' : '❌ Fail'}
                          </span>
                          {r.latencyMs != null && (
                            <span className="text-[10px] text-slate-400 font-mono">{r.latencyMs}ms</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!testModal.modelResults?.length && !testModal.success && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-800 dark:text-rose-200">
                    <p className="font-bold mb-1">Troubleshooting:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      <li>Check your API key on aistudio.google.com</li>
                      <li>Rate limit? Wait 1-2 minutes and try again</li>
                      <li>Ensure key has no extra spaces</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-white/10 flex justify-end shrink-0 bg-slate-50 dark:bg-white/[0.02]">
                <button onClick={() => setTestModal(p => ({ ...p, isOpen: false }))}
                  className={`px-6 py-2 rounded-xl text-xs font-bold text-white cursor-pointer ${testModal.success ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}>
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
