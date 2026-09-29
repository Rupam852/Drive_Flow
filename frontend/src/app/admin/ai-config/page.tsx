'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Key,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Play,
  X,
  ShieldCheck,
  Zap,
  ArrowRight,
  Settings2,
  Cpu,
  Search,
  Layers,
  Server,
  Activity,
  Check,
  ExternalLink,
  Sliders,
  ChevronRight,
  Info,
  Radio,
  Clock,
  Gauge,
  HelpCircle,
} from 'lucide-react';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelOption {
  id: string;
  name: string;
  series: 'Gemini 3.x' | 'Gemini 2.5' | 'Aliases' | 'NVIDIA NIM';
  badge: string;
  badgeColor: string;
  speed: 'Ultra Fast' | 'Fast' | 'Balanced' | 'Deep Reasoning';
  contextWindow: string;
  description: string;
  isRecommended?: boolean;
}

interface ModelTestResult {
  model: string;
  provider?: string;
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

const ALL_MODELS: ModelOption[] = [
  // ── Gemini 3.x Series ──
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    series: 'Gemini 3.x',
    badge: 'Latest & Recommended',
    badgeColor: 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30',
    speed: 'Ultra Fast',
    contextWindow: '1M Context',
    description: 'Next-gen flagship flash model with ultra-low latency and state-of-the-art transactional copywriting.',
    isRecommended: true,
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    series: 'Gemini 3.x',
    badge: 'Agentic',
    badgeColor: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30',
    speed: 'Ultra Fast',
    contextWindow: '1M Context',
    description: 'Advanced agentic capabilities with superior structured JSON formatting accuracy.',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    series: 'Gemini 3.x',
    badge: 'Balanced',
    badgeColor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30',
    speed: 'Fast',
    contextWindow: '1M Context',
    description: 'Balanced throughput and reasoning performance for system announcements.',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    series: 'Gemini 3.x',
    badge: 'Fast',
    badgeColor: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30',
    speed: 'Fast',
    contextWindow: '1M Context',
    description: 'Lightweight, rapid response model optimized for high-volume notifications.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    series: 'Gemini 3.x',
    badge: 'Ultra Fast',
    badgeColor: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-500/30',
    speed: 'Ultra Fast',
    contextWindow: '512K Context',
    description: 'Sub-second generation speed with minimal compute token usage.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    series: 'Gemini 3.x',
    badge: 'Lite',
    badgeColor: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30',
    speed: 'Ultra Fast',
    contextWindow: '512K Context',
    description: 'High throughput lite model ideal for background email polishing.',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    series: 'Gemini 3.x',
    badge: 'Preview',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/30',
    speed: 'Fast',
    contextWindow: '1M Context',
    description: 'Early preview release containing upcoming experimental Gemini 3 enhancements.',
  },

  // ── Gemini 2.5 Series ──
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    series: 'Gemini 2.5',
    badge: 'Stable LTS',
    badgeColor: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30',
    speed: 'Fast',
    contextWindow: '1M Context',
    description: 'Long-term stable workhorse model with rock-solid consistency and 99.9% uptime.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    series: 'Gemini 2.5',
    badge: 'Lite',
    badgeColor: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-500/30',
    speed: 'Ultra Fast',
    contextWindow: '512K Context',
    description: 'Compact stable runtime with ultra-fast generation times.',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    series: 'Gemini 2.5',
    badge: 'Pro Reasoning',
    badgeColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30',
    speed: 'Deep Reasoning',
    contextWindow: '2M Context',
    description: 'Deep analytical capabilities and expansive multi-turn reasoning context.',
  },

  // ── Aliases (Auto-Routing) ──
  {
    id: 'gemini-flash-latest',
    name: 'Flash (Latest Alias)',
    series: 'Aliases',
    badge: 'Auto-Routing',
    badgeColor: 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-500/30',
    speed: 'Fast',
    contextWindow: 'Dynamic',
    description: 'Google AI Studio automatically forwards requests to the current production Flash model.',
  },
  {
    id: 'gemini-flash-lite-latest',
    name: 'Flash Lite (Latest Alias)',
    series: 'Aliases',
    badge: 'Auto-Routing',
    badgeColor: 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-500/30',
    speed: 'Ultra Fast',
    contextWindow: 'Dynamic',
    description: 'Automatically targets the latest lightweight flash release from Google.',
  },
  {
    id: 'gemini-pro-latest',
    name: 'Pro (Latest Alias)',
    series: 'Aliases',
    badge: 'Auto-Routing',
    badgeColor: 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-500/30',
    speed: 'Deep Reasoning',
    contextWindow: 'Dynamic',
    description: 'Automatically points to Google’s most powerful pro-tier intelligence model.',
  },

  // ── NVIDIA NIM Models ──
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    name: 'Nemotron 3 Super 120B',
    series: 'NVIDIA NIM',
    badge: '⚡ 3.2s Fast Failover',
    badgeColor: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30',
    speed: 'Ultra Fast',
    contextWindow: '128K Context',
    description: 'Enterprise 120B parameter model hosted on NVIDIA high-speed GPU clusters for zero-downtime failover.',
    isRecommended: true,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT OSS 20B',
    series: 'NVIDIA NIM',
    badge: '5.9s Latency',
    badgeColor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30',
    speed: 'Fast',
    contextWindow: '32K Context',
    description: 'High efficiency open weights model running on NVIDIA NIM inference microservice.',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    name: 'Nemotron 3.5 Lightning 30B',
    series: 'NVIDIA NIM',
    badge: '7.4s Latency',
    badgeColor: 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-500/30',
    speed: 'Balanced',
    contextWindow: '64K Context',
    description: 'Cost-optimized 30B failover backup model for extreme redundancy.',
  },
];

const SERIES_TABS = ['All Models', 'Gemini 3.x', 'Gemini 2.5', 'Aliases', 'NVIDIA NIM'] as const;

export default function AdminAiConfigPage() {
  // ── Gemini State ──
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [customModel, setCustomModel] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [enableAutoFallback, setEnableAutoFallback] = useState(true);
  const [temperature, setTemperature] = useState(0.7);

  // ── NVIDIA State ──
  const [nvidiaKeyInput, setNvidiaKeyInput] = useState('');
  const [maskedNvidiaKey, setMaskedNvidiaKey] = useState('');
  const [hasNvidiaKey, setHasNvidiaKey] = useState(false);
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);
  const [enableNvidia, setEnableNvidia] = useState(false);
  const [nvidiaModel, setNvidiaModel] = useState('nvidia/nemotron-3-super-120b-a12b');

  // ── Diagnostics / Status ──
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [lastTestStatus, setLastTestStatus] = useState<'success' | 'failed' | null>(null);
  const [lastTestError, setLastTestError] = useState<string | null>(null);

  // ── UI States & Filters ──
  const [activeTab, setActiveTab] = useState<'models' | 'credentials' | 'redundancy'>('models');
  const [modelFilter, setModelFilter] = useState<(typeof SERIES_TABS)[number]>('All Models');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testModal, setTestModal] = useState<TestModal>({ isOpen: false, success: false, title: '', message: '' });

  // ── Fetch Config ──
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

      const isCustom = !ALL_MODELS.some(m => m.id === data.selectedModel);
      if (isCustom && data.selectedModel) {
        setShowCustom(true);
        setCustomModel(data.selectedModel);
      }
    } catch {
      setToast({ type: 'error', text: 'Failed to load AI settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // ── Filtered Models List ──
  const filteredModels = useMemo(() => {
    return ALL_MODELS.filter(m => {
      // Exclude NVIDIA models from primary Gemini model list if browsing Gemini
      const matchesTab =
        modelFilter === 'All Models'
          ? true
          : m.series === modelFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.badge.toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [modelFilter, searchQuery]);

  // ── Save Handler ──
  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSaving(true);
    setToast(null);
    try {
      const finalModel = showCustom && customModel.trim() ? customModel.trim() : selectedModel;
      const payload: any = {
        selectedModel: finalModel,
        enableAutoFallback,
        temperature,
        enableNvidiaFallback: enableNvidia,
        nvidiaModel,
      };

      const gKey = apiKeyInput.trim();
      if (gKey) payload.apiKey = gKey;
      const nKey = nvidiaKeyInput.trim();
      if (nKey) payload.nvidiaApiKey = nKey;

      const { data } = await api.put('/ai/config', payload);
      setToast({ type: 'success', text: data.message || 'AI configuration saved successfully!' });
      setHasExistingKey(!!data.hasKey);
      setMaskedKey(data.maskedKey || '');
      setSelectedModel(finalModel);
      setApiKeyInput('');
      if (data.hasNvidiaKey !== undefined) setHasNvidiaKey(data.hasNvidiaKey);
      if (data.maskedNvidiaKey) setMaskedNvidiaKey(data.maskedNvidiaKey);
      setNvidiaKeyInput('');
    } catch (err: any) {
      setToast({ type: 'error', text: err.response?.data?.message || 'Failed to save configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Test Connection Handler ──
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
      setLastTestError(geminiOk ? null : data.primaryError || 'Primary connection failed');

      setTestModal({
        isOpen: true,
        success: data.success,
        title: geminiOk
          ? '✅ Primary Model Connected Successfully'
          : data.nvidiaStatus === 'success'
          ? '⚠️ Gemini Failed — NVIDIA Fallback Verified'
          : '❌ Connection Verification Failed',
        message: data.message || '',
        workingCount: data.workingCount,
        failedCount: data.failedCount,
        totalTested: data.totalTested,
        latencyMs: data.primaryLatencyMs,
        modelResults: results,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'AI test request failed.';
      setLastTestStatus('failed');
      setLastTestedAt(new Date().toISOString());
      setLastTestError(msg);
      setTestModal({
        isOpen: true,
        success: false,
        title: '❌ Connection Verification Failed',
        message: msg,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return iso;
    }
  };

  // ── Quick Presets for Temperature ──
  const tempPresets = [
    { label: 'Precise (0.2)', value: 0.2, desc: 'Exact & factual' },
    { label: 'Balanced (0.7)', value: 0.7, desc: 'Recommended default' },
    { label: 'Creative (1.2)', value: 1.2, desc: 'Engaging & expressive' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* ── Top Header Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-100 via-indigo-50/60 to-purple-50 dark:from-purple-950/40 dark:via-slate-900/60 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-500/20 backdrop-blur-xl p-6 sm:p-8 shadow-sm">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-purple-200/70 dark:bg-purple-500/20 text-purple-900 dark:text-purple-300 border border-purple-300/80 dark:border-purple-500/30 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-300 animate-pulse" />
                <span>DriveFlow AI Intelligence Hub</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/90 dark:bg-white/5 text-slate-800 dark:text-slate-300 border border-slate-300/80 dark:border-white/10 shadow-xs">
                <Cpu className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span>Multi-Model Auto Fallback</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              AI Engine & Model Configuration
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300/80 max-w-2xl leading-relaxed">
              Fine-tune Gemini models, manage secure API credentials, and orchestrate automated failover chains for 100% notification deliverability.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center">
            <button
              type="button"
              onClick={fetchConfig}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-xs"
              title="Reload configuration"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Status Health Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Gemini Primary Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 shadow-sm hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-purple-500" />
              <span>Gemini Primary</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                hasExistingKey
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${hasExistingKey ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
              {hasExistingKey ? 'Active Key' : 'Key Missing'}
            </span>
          </div>
          <div className="mt-2.5">
            <p className="text-sm font-bold text-slate-900 dark:text-white font-mono truncate">
              {selectedModel}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {hasExistingKey ? `Masked: ${maskedKey}` : 'Configure API key below'}
            </p>
          </div>
        </div>

        {/* Multi-Model Fallback Pool */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 shadow-sm hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Level 2 Fallback Pool</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                enableAutoFallback
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20'
              }`}
            >
              {enableAutoFallback ? '10 Models Standby' : 'Disabled'}
            </span>
          </div>
          <div className="mt-2.5">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {enableAutoFallback ? 'Automatic Failover' : 'Single Model Mode'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {enableAutoFallback ? 'Sequential failover with rate-limit dampening' : 'Stops on primary model error'}
            </p>
          </div>
        </div>

        {/* NVIDIA Failover Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 shadow-sm hover:border-green-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              <span>Level 3 NVIDIA Failover</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                enableNvidia && hasNvidiaKey
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                  : enableNvidia
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20'
              }`}
            >
              {enableNvidia && hasNvidiaKey ? 'Ready' : enableNvidia ? 'Key Required' : 'Inactive'}
            </span>
          </div>
          <div className="mt-2.5">
            <p className="text-sm font-bold text-slate-900 dark:text-white font-mono truncate">
              {enableNvidia ? nvidiaModel.replace('nvidia/', '') : 'Disabled'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {lastTestedAt ? `Last verified: ${formatTime(lastTestedAt)}` : 'Connection not verified yet'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Toast Alert ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold border shadow-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{toast.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Tabbed Navigation ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('models')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'models'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/80 dark:border-transparent'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Model Catalog & Tuning</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'credentials'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/80 dark:border-transparent'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>API Credentials</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('redundancy')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'redundancy'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/80 dark:border-transparent'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>High-Availability Pipeline</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: MODEL CATALOG & TUNING                                             */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            {/* Catalog Filter Bar */}
            <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span>Select Primary Gemini Model</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Choose which model executes email drafting, tone polishing, and summaries.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search models..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-purple-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Series Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {SERIES_TABS.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setModelFilter(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      modelFilter === tab
                        ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Model Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {filteredModels.map(model => {
                  const isSelected = selectedModel === model.id && !showCustom;
                  const isNvidia = model.series === 'NVIDIA NIM';

                  return (
                    <div
                      key={model.id}
                      onClick={() => {
                        if (isNvidia) {
                          setNvidiaModel(model.id);
                          setEnableNvidia(true);
                        } else {
                          setSelectedModel(model.id);
                          setShowCustom(false);
                        }
                      }}
                      className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-500/10 shadow-md ring-2 ring-purple-500/20'
                          : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? 'border-purple-600 bg-purple-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                                <span>{model.name}</span>
                                {model.isRecommended && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-400/20 text-amber-600 dark:text-amber-400 border border-amber-400/30">
                                    ★ Top Choice
                                  </span>
                                )}
                              </h3>
                              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                {model.id}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${model.badgeColor}`}>
                            {model.badge}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300/90 mt-3 leading-relaxed">
                          {model.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-500" />
                          <span>{model.speed}</span>
                        </span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                          {model.contextWindow}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Model ID Entry */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCustom(v => !v)}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>{showCustom ? '← Select from standard models' : '+ Enter custom Gemini model identifier'}</span>
                </button>

                {showCustom && (
                  <div className="mt-3 p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 space-y-2">
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Custom Model ID (e.g. `gemini-2.0-flash-exp`)
                    </label>
                    <input
                      type="text"
                      value={customModel}
                      onChange={e => setCustomModel(e.target.value)}
                      placeholder="e.g. gemini-2.0-flash-exp"
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#111422] border border-purple-300 dark:border-purple-500/40 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Model Hyperparameters (Temperature) */}
            <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-500" />
                    <span>Generation Temperature & Tone</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Controls creativity vs consistency in drafted notifications.
                  </p>
                </div>
                <span className="text-sm font-bold font-mono px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                  {temperature.toFixed(1)}
                </span>
              </div>

              {/* Slider */}
              <div className="space-y-2 pt-2">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature}
                  onChange={e => setTemperature(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>0.0 (Strict & Precise)</span>
                  <span>1.0 (Balanced)</span>
                  <span>2.0 (High Creativity)</span>
                </div>
              </div>

              {/* Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                {tempPresets.map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setTemperature(preset.value)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      Math.abs(temperature - preset.value) < 0.05
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-900 dark:text-purple-200 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <p className="text-xs font-bold">{preset.label}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{preset.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: API CREDENTIALS                                                    */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'credentials' && (
          <div className="space-y-6">
            {/* Google Gemini API Key */}
            <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Google Gemini API Key
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Powers all email drafting, rewriting, and delivery tone auditing.
                    </p>
                  </div>
                </div>

                {hasExistingKey && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                    ✓ Active: {maskedKey}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Enter Gemini API Key (starts with `AIzaSy...`)
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder={hasExistingKey ? 'Enter new key to replace current key...' : 'AIzaSy...'}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                  >
                    <span>Get a free Google AI Studio API Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-[11px] text-slate-400">Stored encrypted in secure database</span>
                </div>
              </div>
            </div>

            {/* NVIDIA NIM Failover Key */}
            <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-600 to-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      NVIDIA NIM API Key (Level 3 Redundancy)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Standby failover provider if Google Gemini undergoes downtime or rate-limiting.
                    </p>
                  </div>
                </div>

                {hasNvidiaKey && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30 shrink-0">
                    ✓ Active: {maskedNvidiaKey}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Enter NVIDIA API Key (starts with `nvapi-...`)
                </label>
                <div className="relative">
                  <input
                    type={showNvidiaKey ? 'text' : 'password'}
                    value={nvidiaKeyInput}
                    onChange={e => setNvidiaKeyInput(e.target.value)}
                    placeholder={hasNvidiaKey ? 'Enter new key to replace current key...' : 'nvapi-...'}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNvidiaKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    {showNvidiaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <a
                    href="https://build.nvidia.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400 hover:underline font-semibold"
                  >
                    <span>Get NVIDIA NIM API Key from build.nvidia.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-[11px] text-slate-400">1000 free inference credits included</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: HIGH-AVAILABILITY PIPELINE                                         */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'redundancy' && (
          <div className="space-y-6">
            {/* Visual Pipeline Map */}
            <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-500" />
                  <span>3-Tier Failover Architecture</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  DriveFlow automatically cascades down this hierarchy until a valid notification response is obtained.
                </p>
              </div>

              {/* Step 1 -> Step 2 -> Step 3 Pipeline */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                {/* Level 1 */}
                <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">
                      Tier 1: Primary
                    </span>
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Primary Gemini Engine</h4>
                  <p className="text-[11px] font-mono text-purple-700 dark:text-purple-300 mt-1 truncate">
                    {selectedModel}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Direct call with custom temperature and prompt parameters.
                  </p>
                </div>

                {/* Level 2 */}
                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white">
                      Tier 2: Gemini Pool
                    </span>
                    <span className={`w-2 h-2 rounded-full ${enableAutoFallback ? 'bg-amber-500' : 'bg-slate-400'}`} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">10-Model Multi-Fallback</h4>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                    {enableAutoFallback ? 'Active Pool' : 'Disabled'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Iterates through 3.7, 3.6, 3.5, 2.5-flash with rate-limit protection.
                  </p>
                </div>

                {/* Level 3 */}
                <div className="p-4 rounded-2xl bg-green-50/60 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-600 text-white">
                      Tier 3: NVIDIA NIM
                    </span>
                    <span className={`w-2 h-2 rounded-full ${enableNvidia && hasNvidiaKey ? 'bg-green-500' : 'bg-slate-400'}`} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Emergency Failover</h4>
                  <p className="text-[11px] font-mono text-green-700 dark:text-green-400 mt-1 truncate">
                    {enableNvidia ? nvidiaModel : 'Inactive'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Activates if Google API is fully unreachable or exhausted.
                  </p>
                </div>
              </div>
            </div>

            {/* Toggle Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Level 2 Toggle */}
              <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Enable Gemini Model Cascade (Level 2)
                  </span>
                  <button
                    type="button"
                    onClick={() => setEnableAutoFallback(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      enableAutoFallback ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        enableAutoFallback ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  When enabled, if your selected primary model faces a rate limit or 503 outage, DriveFlow will silently cycle through backup Gemini models so notification generation never fails.
                </p>
              </div>

              {/* Level 3 Toggle */}
              <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Enable NVIDIA NIM Failover (Level 3)
                  </span>
                  <button
                    type="button"
                    onClick={() => setEnableNvidia(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      enableNvidia ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        enableNvidia ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Provides a secondary enterprise cloud AI provider outside of Google Cloud to guarantee 100% operational uptime during unexpected global API outages.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Floating Action Bar for Save & Test ── */}
        <div className="sticky bottom-4 z-30 p-4 rounded-2xl bg-white/95 dark:bg-[#121626]/95 backdrop-blur-xl border border-slate-300/80 dark:border-white/15 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>
              Configured: <strong className="font-mono text-purple-700 dark:text-purple-400">{selectedModel}</strong>
              {enableNvidia && <span className="text-slate-500 dark:text-slate-400"> + NVIDIA Failover</span>}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Test Connection Button */}
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !hasExistingKey}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-40 shadow-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-white/15"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600 dark:text-purple-400" />
                  <span>Verifying API...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-purple-600 text-purple-600 dark:fill-white dark:text-white" />
                  <span>Test Connection</span>
                </>
              )}
            </button>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save All Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ── Test Diagnostics Modal ── */}
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
              <div
                className={`p-5 border-b flex items-start justify-between gap-3 shrink-0 ${
                  testModal.success
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30'
                    : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30'
                }`}
              >
                <div>
                  <h3
                    className={`text-base font-bold ${
                      testModal.success ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    {testModal.title}
                  </h3>
                  {testModal.totalTested != null && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        ✅ {testModal.workingCount} Working
                      </span>
                      {testModal.failedCount ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                          ❌ {testModal.failedCount} Failed
                        </span>
                      ) : null}
                      <span className="text-[10px] text-slate-400">({testModal.totalTested} tested in pool)</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setTestModal(p => ({ ...p, isOpen: false }))}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1 p-5 space-y-3.5">
                <p
                  className={`text-xs font-semibold ${
                    testModal.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {testModal.message}
                </p>

                {testModal.modelResults && testModal.modelResults.length > 0 && (
                  <div className="space-y-2">
                    {testModal.modelResults.map((r: any) => (
                      <div
                        key={r.model}
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs ${
                          r.status === 'success'
                            ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                            : 'bg-rose-50/50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{r.model}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                r.provider === 'nvidia'
                                  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                  : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                              }`}
                            >
                              {r.provider === 'nvidia' ? 'NVIDIA NIM' : 'Gemini'}
                            </span>
                          </div>
                          {r.status === 'failed' && r.error && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 line-clamp-2">{r.error}</p>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <span
                            className={`font-bold text-xs ${
                              r.status === 'success'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {r.status === 'success' ? 'Connected' : 'Error'}
                          </span>
                          {r.latencyMs != null && (
                            <span className="block text-[10px] text-slate-400 font-mono">{r.latencyMs}ms</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-white/10 flex justify-end shrink-0 bg-slate-50 dark:bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => setTestModal(p => ({ ...p, isOpen: false }))}
                  className={`px-6 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer ${
                    testModal.success ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  Close Diagnostics
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
