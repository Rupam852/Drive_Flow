import { Request, Response } from 'express';
import axios from 'axios';
import { AiConfig } from '../models/AiConfig';
import { logActivity } from '../utils/logger';

const DEFAULT_MODELS = [
  // Gemini 3.x Series (Latest - Special Access)
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  // Gemini 2.5 Series (Stable)
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  // Aliases
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
];

// Helper to get or create the single AI config document
const getOrCreateAiConfig = async () => {
  let config = await AiConfig.findOne();
  if (!config) {
    config = await AiConfig.create({
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      selectedModel: 'gemini-3.8-flash',
      availableModels: DEFAULT_MODELS,
      enableAutoFallback: true,
      temperature: 0.7,
    });
    return config;
  }

  const doc = config;
  let modified = false;

  // Reset to gemini-3.8-flash as best default (we now have verified working models)
  if (!doc.selectedModel) {
    doc.selectedModel = 'gemini-3.8-flash';
    modified = true;
  }

  // Update available models to verified Gemini 3 models
  doc.availableModels = DEFAULT_MODELS;
  modified = true;

  if (doc.enableAutoFallback === undefined) {
    doc.enableAutoFallback = true;
    modified = true;
  }

  // If database key is empty, populate from process.env if available
  if (!doc.geminiApiKey && process.env.GEMINI_API_KEY) {
    doc.geminiApiKey = process.env.GEMINI_API_KEY;
    modified = true;
  }

  if (modified) await doc.save();
  return doc;
};

// Mask API key for safe display (e.g. AIzaSy...3aX9)
const maskApiKey = (key: string) => {
  if (!key || key.length < 10) return '';
  return `${key.slice(0, 6)}••••••••••••••••${key.slice(-4)}`;
};

// @desc    Get AI configuration (Admin only)
// @route   GET /api/ai/config
// @access  Private/Admin
export const getAiConfig = async (_req: Request, res: Response) => {
  try {
    const config = await getOrCreateAiConfig();

    res.json({
      hasKey: !!config.geminiApiKey,
      maskedKey: maskApiKey(config.geminiApiKey),
      selectedModel: config.selectedModel || 'gemini-3.8-flash',
      availableModels: config.availableModels && config.availableModels.length > 0
        ? config.availableModels
        : DEFAULT_MODELS,
      enableAutoFallback: config.enableAutoFallback !== false,
      temperature: config.temperature ?? 0.7,
      // NVIDIA fallback
      hasNvidiaKey: !!config.nvidiaApiKey,
      maskedNvidiaKey: maskApiKey(config.nvidiaApiKey || ''),
      enableNvidiaFallback: config.enableNvidiaFallback === true,
      nvidiaModel: config.nvidiaModel || 'nvidia/nemotron-3-super-120b-a12b',
      // Test metadata
      lastTestedAt: config.lastTestedAt,
      lastTestStatus: config.lastTestStatus,
      lastTestError: config.lastTestError,
      updatedAt: config.updatedAt,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch AI configuration' });
  }
};

// @desc    Update AI configuration (Admin only)
// @route   PUT /api/ai/config
// @access  Private/Admin
export const updateAiConfig = async (req: Request, res: Response) => {
  try {
    const { apiKey, selectedModel, enableAutoFallback, temperature,
            nvidiaApiKey, enableNvidiaFallback, nvidiaModel } = req.body;
    const config = await getOrCreateAiConfig();

    if (apiKey !== undefined && typeof apiKey === 'string') {
      const trimmed = apiKey.trim();
      if (trimmed && !trimmed.includes('••••')) config.geminiApiKey = trimmed;
      else if (trimmed === '') config.geminiApiKey = '';
    }

    if (selectedModel && typeof selectedModel === 'string') config.selectedModel = selectedModel.trim();
    if (enableAutoFallback !== undefined) config.enableAutoFallback = Boolean(enableAutoFallback);
    if (temperature !== undefined && typeof temperature === 'number') {
      config.temperature = Math.min(2, Math.max(0, temperature));
    }

    // NVIDIA fallback settings
    if (nvidiaApiKey !== undefined && typeof nvidiaApiKey === 'string') {
      const trimmed = nvidiaApiKey.trim();
      if (trimmed && !trimmed.includes('••••')) config.nvidiaApiKey = trimmed;
      else if (trimmed === '') config.nvidiaApiKey = '';
    }
    if (enableNvidiaFallback !== undefined) config.enableNvidiaFallback = Boolean(enableNvidiaFallback);
    if (nvidiaModel && typeof nvidiaModel === 'string') config.nvidiaModel = nvidiaModel.trim();

    await config.save();

    await logActivity(
      String((req as any).user?._id || ''),
      'UPDATE_AI_CONFIG',
      `Admin updated AI configuration (Model: ${config.selectedModel}, NVIDIA Fallback: ${config.enableNvidiaFallback})`
    );

    res.json({
      message: 'AI Configuration saved successfully!',
      hasKey: !!config.geminiApiKey,
      maskedKey: maskApiKey(config.geminiApiKey),
      selectedModel: config.selectedModel,
      availableModels: config.availableModels,
      enableAutoFallback: config.enableAutoFallback,
      temperature: config.temperature,
      hasNvidiaKey: !!config.nvidiaApiKey,
      maskedNvidiaKey: maskApiKey(config.nvidiaApiKey || ''),
      enableNvidiaFallback: config.enableNvidiaFallback,
      nvidiaModel: config.nvidiaModel,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update AI configuration' });
  }
};

// @desc    Test connection — tests primary Gemini model + NVIDIA fallback (if enabled)
// @route   POST /api/ai/test
// @access  Private/Admin
export const testAiConnection = async (req: Request, res: Response) => {
  try {
    const { apiKey: testKey, model: testModel } = req.body;
    const config = await getOrCreateAiConfig();

    const effectiveKey = (testKey && typeof testKey === 'string' && !testKey.includes('••••'))
      ? testKey.trim()
      : config.geminiApiKey;

    const primaryModel = (testModel && typeof testModel === 'string')
      ? testModel.trim()
      : (config.selectedModel || 'gemini-3.8-flash');

    if (!effectiveKey) {
      res.status(400).json({ success: false, message: 'No Gemini API Key saved. Please save a key first.' });
      return;
    }

    interface TestResult {
      model: string;
      provider: 'gemini' | 'nvidia';
      isPrimary: boolean;
      status: 'success' | 'failed';
      latencyMs: number;
      error?: string;
    }
    const results: TestResult[] = [];

    // ── 1. Test primary Gemini model ─────────────────────────────────────────
    const geminiStart = Date.now();
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${primaryModel}:generateContent?key=${effectiveKey}`;
      const gRes = await axios.post(endpoint,
        { contents: [{ parts: [{ text: 'Say: OK' }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 10 } },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      const reply = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
      results.push({ model: primaryModel, provider: 'gemini', isPrimary: true, status: 'success', latencyMs: Date.now() - geminiStart });
      console.log(`[Test] Gemini primary '${primaryModel}' OK (${Date.now() - geminiStart}ms): ${reply}`);
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Unknown error';
      results.push({ model: primaryModel, provider: 'gemini', isPrimary: true, status: 'failed', latencyMs: Date.now() - geminiStart, error: errMsg.substring(0, 150) });
      console.warn(`[Test] Gemini primary '${primaryModel}' FAILED: ${errMsg}`);
    }

    // ── 2. Test NVIDIA fallback model (if configured) ────────────────────────
    if (config.enableNvidiaFallback && config.nvidiaApiKey) {
      const nvModel = config.nvidiaModel || 'nvidia/nemotron-3-super-120b-a12b';
      const nvStart = Date.now();
      try {
        const nvRes = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions',
          { model: nvModel, messages: [{ role: 'user', content: 'Say: OK' }], temperature: 0.1, max_tokens: 10 },
          { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.nvidiaApiKey}` }, timeout: 20000 }
        );
        const reply = nvRes.data?.choices?.[0]?.message?.content?.trim() || 'OK';
        results.push({ model: nvModel, provider: 'nvidia', isPrimary: false, status: 'success', latencyMs: Date.now() - nvStart });
        console.log(`[Test] NVIDIA '${nvModel}' OK (${Date.now() - nvStart}ms): ${reply}`);
      } catch (err: any) {
        const errMsg = err.response?.data?.detail || err.response?.data?.error?.message || err.message || 'Unknown error';
        results.push({ model: nvModel, provider: 'nvidia', isPrimary: false, status: 'failed', latencyMs: Date.now() - nvStart, error: String(errMsg).substring(0, 150) });
        console.warn(`[Test] NVIDIA '${nvModel}' FAILED: ${errMsg}`);
      }
    }

    const geminiResult = results.find(r => r.provider === 'gemini')!;
    const nvidiaResult = results.find(r => r.provider === 'nvidia');
    const geminiOk = geminiResult.status === 'success';
    const nvidiaOk = nvidiaResult?.status === 'success';

    // Save test result
    config.lastTestedAt = new Date();
    config.lastTestStatus = geminiOk ? 'success' : 'failed';
    config.lastTestError = geminiOk ? undefined : geminiResult.error;
    await config.save();

    const overallOk = geminiOk || nvidiaOk;
    let message = '';
    if (geminiOk) message = `✅ Gemini '${primaryModel}' is working (${geminiResult.latencyMs}ms).`;
    else if (nvidiaOk) message = `⚠️ Gemini failed — but NVIDIA fallback is ready! Production will auto-switch.`;
    else message = `❌ Both Gemini and NVIDIA failed. Check your API keys.`;

    res.json({
      success: overallOk,
      primaryModel,
      primaryStatus: geminiResult.status,
      primaryLatencyMs: geminiResult.latencyMs,
      primaryError: geminiResult.error,
      nvidiaStatus: nvidiaResult?.status || null,
      nvidiaLatencyMs: nvidiaResult?.latencyMs || null,
      nvidiaModel: nvidiaResult?.model || null,
      nvidiaError: nvidiaResult?.error || null,
      modelResults: results,
      workingCount: results.filter(r => r.status === 'success').length,
      failedCount: results.filter(r => r.status === 'failed').length,
      totalTested: results.length,
      message,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Internal error while testing connection' });
  }
};


// Helper to clean markdown asterisks, bullets, and spacing for human-readable emails
const cleanEmailTextAndRemoveAsterisks = (text: string): string => {
  if (!text) return '';
  return text
    // Replace markdown bold like **Heading** or **word** with just Heading or word
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Replace markdown italics like *word* with word
    .replace(/(^|[^\*])\*(?!\s)([^*]+)\*(?!\*)/g, '$1$2')
    // Replace markdown bullet points like '* ' or '- ' at beginning of lines with '• '
    .replace(/^[\*\-]\s+/gm, '• ')
    // Replace any remaining stray double/triple asterisks
    .replace(/\*{2,}/g, '')
    // Clean up multiple extra empty lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Helper to robustly extract subject and message from Gemini output even if truncated or unclosed
const extractSubjectAndMessage = (
  rawText: string,
  fallbackSubject: string
): { subject: string; message: string } => {
  if (!rawText) return { subject: fallbackSubject, message: '' };

  let cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  // 1. Try standard JSON.parse first
  try {
    const parsed = JSON.parse(cleanText);
    if (parsed && typeof parsed === 'object') {
      const subj = typeof parsed.subject === 'string' ? parsed.subject : fallbackSubject;
      const msg = typeof parsed.message === 'string' ? parsed.message : '';
      if (msg) {
        return {
          subject: cleanEmailTextAndRemoveAsterisks(subj),
          message: cleanEmailTextAndRemoveAsterisks(msg),
        };
      }
    }
  } catch (e) {
    // If standard JSON.parse fails, do intelligent regex extraction
  }

  // 2. Intelligent Regex extraction for truncated or unescaped JSON
  let extractedSubject = fallbackSubject;
  let extractedMessage = '';

  const subjectMatch = cleanText.match(/"subject"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  if (subjectMatch && subjectMatch[1]) {
    try {
      extractedSubject = JSON.parse(`"${subjectMatch[1]}"`);
    } catch {
      extractedSubject = subjectMatch[1].replace(/\\"/g, '"');
    }
  }

  // Match message content until end of quote or end of string if truncated
  const messageMatch = cleanText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|\s*$)/i);
  if (messageMatch && messageMatch[1]) {
    try {
      extractedMessage = JSON.parse(`"${messageMatch[1]}"`);
    } catch {
      extractedMessage = messageMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\t/g, '\t');
    }
  } else {
    // If no explicit "message" key found, strip any leading JSON brackets/keys
    let stripped = cleanText;
    if (stripped.startsWith('{') && stripped.includes('"message"')) {
      const idx = stripped.indexOf('"message"');
      stripped = stripped.substring(idx + 9).replace(/^\s*:\s*"/, '').replace(/"\s*\}?$/, '');
    }
    extractedMessage = stripped;
  }

  return {
    subject: cleanEmailTextAndRemoveAsterisks(extractedSubject || fallbackSubject || 'DriveFlow System Notice'),
    message: cleanEmailTextAndRemoveAsterisks(extractedMessage || cleanText),
  };
};

// @desc    Draft or Polish notification with Gemini AI (Admin only)
// @route   POST /api/ai/assist
// @access  Private/Admin
export const assistNotification = async (req: Request, res: Response) => {
  try {
    const { mode, prompt, currentSubject, currentMessage } = req.body;
    const config = await getOrCreateAiConfig();

    if (!config.geminiApiKey && !(config.enableNvidiaFallback && config.nvidiaApiKey)) {
      res.status(400).json({
        success: false,
        message: 'No AI API key is configured. Please go to AI Settings and configure Gemini or NVIDIA.',
      });
      return;
    }

    const primaryModel = config.selectedModel || 'gemini-3.8-flash';

    let systemInstruction = '';
    let userContent = '';

    if (mode === 'draft') {
      if (!prompt || !prompt.trim()) {
        res.status(400).json({ success: false, message: 'Please provide a prompt describing what you want to notify users about.' });
        return;
      }

      systemInstruction = `You are the lead communications specialist for DriveFlow, a high-performance cloud storage and file management platform.
Your task is to draft a professional, clear notification and email announcement based on the administrator's request.
CRITICAL FORMATTING & DELIVERABILITY RULES:
1. DO NOT use markdown asterisks (no **bold**, no *italic*, and no * for bullets). In plain text email boxes, asterisks look messy and unrendered.
2. For headings/sections, use clean plain text followed by a colon (e.g. "MAINTENANCE SCHEDULE:" or "Details:").
3. For lists, use the bullet character "• " instead of asterisks "* ".
4. Subject must be informative and transactional (e.g., "DriveFlow Service Notice: ...", "Account Notice: ...").
5. Output MUST be strictly valid JSON with exactly two fields: "subject" and "message".
Example:
{
  "subject": "DriveFlow Service Notice: Scheduled Infrastructure Maintenance",
  "message": "Hello,\\n\\nPlease be advised that DriveFlow will undergo scheduled system maintenance to improve platform reliability, security, and cloud performance.\\n\\n• Date: This weekend\\n• Duration: Approximately 30-45 minutes\\n\\nDuring this brief window, file synchronization may experience temporary delays. Your data remains fully secure and encrypted.\\n\\nThank you for your patience and support.\\n\\nBest regards,\\nDriveFlow Operations Team"
}`;
      userContent = `Create a notification draft for: ${prompt.trim()}`;
    } else if (mode === 'polish') {
      if (!currentMessage || !currentMessage.trim()) {
        res.status(400).json({ success: false, message: 'Message body text is empty. Please enter some text to polish.' });
        return;
      }

      systemInstruction = `You are an expert copy editor for DriveFlow cloud platform.
Your task is to refine, grammar-check, and elevate the provided email draft into a clean, professional email.
CRITICAL FORMATTING & DELIVERABILITY RULES:
1. DO NOT use markdown asterisks (no **bold**, no *italic*, and no * for bullets).
2. For lists, use clean bullets "• " instead of asterisks "* ".
3. Ensure professional, authoritative tone and remove spam triggers so the email lands in Gmail Primary Inbox.
4. Output MUST be strictly valid JSON with exactly two fields: "subject" and "message".`;
      userContent = `Subject: ${currentSubject || ''}\n\nMessage Body:\n${currentMessage}`;
    } else {
      res.status(400).json({ success: false, message: "Invalid mode. Must be 'draft' or 'polish'." });
      return;
    }

    // Determine list of models to try (primary first, then fallback pool if enabled)
    const modelsToTry: string[] = config.geminiApiKey ? [primaryModel] : [];

    if (config.geminiApiKey && config.enableAutoFallback !== false) {
      const fallbackCandidates = [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-flash-latest',
      ];
      fallbackCandidates.forEach(m => {
        if (!modelsToTry.includes(m)) {
          modelsToTry.push(m);
        }
      });
    }

    let successfulResult: { subject?: string; message?: string } | null = null;
    let successfulModel = primaryModel;
    let usedFallback = false;
    let lastError: any = null;

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;

      try {
        const response = await axios.post(
          endpoint,
          {
            contents: [
              {
                parts: [
                  {
                    text: `${systemInstruction}\n\nStrict Rule: Return ONLY raw JSON without markdown formatting, code fences, or surrounding text.\n\n${userContent}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: config.temperature ?? 0.7,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json',
            },
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 25000,
          }
        );

        const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        const parsedResult = extractSubjectAndMessage(rawText, currentSubject || 'DriveFlow System Notice');

        if (parsedResult.message) {
          successfulResult = parsedResult;
          successfulModel = model;
          usedFallback = (i > 0);
          break; // Succeeded! Exit loop
        }
      } catch (apiErr: any) {
        lastError = apiErr;
        const errMsg = apiErr.response?.data?.error?.message || apiErr.message || '';
        console.warn(`[Gemini Assist] Model '${model}' failed: ${errMsg}`);

        // If the API key is completely invalid or forbidden, do not waste time retrying other models
        if (errMsg.includes('API_KEY_INVALID') || apiErr.response?.status === 401 || apiErr.response?.status === 403) {
          break;
        }
      }
    }

    // ── NVIDIA NIM Fallback ───────────────────────────────────────────────
    // If ALL Gemini models failed, try NVIDIA NIM as last resort
    if (!successfulResult && config.enableNvidiaFallback && config.nvidiaApiKey) {
      const nvidiaModel = config.nvidiaModel || 'nvidia/nemotron-3-super-120b-a12b';
      console.log(`[AI Assist] All Gemini models failed. Trying NVIDIA fallback: ${nvidiaModel}`);

      try {
        const nvidiaResponse = await axios.post(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          {
            model: nvidiaModel,
            messages: [
              {
                role: 'system',
                content: `${systemInstruction}\n\nStrict Rule: Return ONLY raw JSON without markdown or code fences.`,
              },
              {
                role: 'user',
                content: userContent,
              },
            ],
            temperature: config.temperature ?? 0.7,
            max_tokens: 1024,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.nvidiaApiKey}`,
            },
            timeout: 30000,
          }
        );

        const rawText = nvidiaResponse.data?.choices?.[0]?.message?.content?.trim() || '';
        const parsedResult = extractSubjectAndMessage(rawText, currentSubject || 'DriveFlow System Notice');

        if (parsedResult.message) {
          successfulResult = parsedResult;
          successfulModel = `nvidia:${nvidiaModel}`;
          usedFallback = true;
          console.log(`[AI Assist] NVIDIA fallback succeeded with ${nvidiaModel}`);
        }
      } catch (nvidiaErr: any) {
        console.warn(`[AI Assist] NVIDIA fallback also failed: ${nvidiaErr.message}`);
      }
    }

    if (!successfulResult) {
      const errorData = lastError?.response?.data?.error;
      const errorMessage = errorData?.message || lastError?.message || 'AI call failed across all Gemini models and NVIDIA fallback';
      res.status(400).json({
        success: false,
        message: errorMessage,
        details: errorData || lastError?.toString(),
      });
      return;
    }

    res.json({
      success: true,
      subject: successfulResult.subject || currentSubject || 'DriveFlow Notice',
      message: successfulResult.message,
      model: successfulModel,
      usedFallback,
      originalModel: primaryModel,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while processing AI request',
    });
  }
};
