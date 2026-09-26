import { Request, Response } from 'express';
import axios from 'axios';
import { AiConfig } from '../models/AiConfig';
import { logActivity } from '../utils/logger';

const DEFAULT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
];

// Helper to get or create the single AI config document
const getOrCreateAiConfig = async () => {
  let config = await AiConfig.findOne();
  if (!config) {
    config = await AiConfig.create({
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      selectedModel: 'gemini-2.5-flash',
      availableModels: DEFAULT_MODELS,
      enableAutoFallback: true,
      temperature: 0.7,
    });
    return config;
  }

  // Ensure newly supported models are present
  const doc = config;
  const existing = new Set(doc.availableModels || []);
  let modified = false;
  DEFAULT_MODELS.forEach(m => {
    if (!existing.has(m)) {
      doc.availableModels.push(m);
      modified = true;
    }
  });
  if (doc.enableAutoFallback === undefined) {
    doc.enableAutoFallback = true;
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
      selectedModel: config.selectedModel || 'gemini-2.5-flash',
      availableModels: config.availableModels && config.availableModels.length > 0
        ? config.availableModels
        : DEFAULT_MODELS,
      enableAutoFallback: config.enableAutoFallback !== false,
      temperature: config.temperature ?? 0.7,
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
    const { apiKey, selectedModel, enableAutoFallback, temperature } = req.body;
    const config = await getOrCreateAiConfig();

    if (apiKey !== undefined && typeof apiKey === 'string') {
      const trimmed = apiKey.trim();
      // If user typed a new key (not masked placeholder)
      if (trimmed && !trimmed.includes('••••')) {
        config.geminiApiKey = trimmed;
      } else if (trimmed === '') {
        config.geminiApiKey = '';
      }
    }

    if (selectedModel && typeof selectedModel === 'string') {
      config.selectedModel = selectedModel.trim();
    }

    if (enableAutoFallback !== undefined) {
      config.enableAutoFallback = Boolean(enableAutoFallback);
    }

    if (temperature !== undefined && typeof temperature === 'number') {
      config.temperature = Math.min(2, Math.max(0, temperature));
    }

    await config.save();

    await logActivity(
      String((req as any).user?._id || ''),
      'UPDATE_AI_CONFIG',
      `Admin updated Gemini AI configuration (Model: ${config.selectedModel}, Auto-Fallback: ${config.enableAutoFallback})`
    );

    res.json({
      message: 'AI Configuration saved successfully!',
      hasKey: !!config.geminiApiKey,
      maskedKey: maskApiKey(config.geminiApiKey),
      selectedModel: config.selectedModel,
      availableModels: config.availableModels,
      enableAutoFallback: config.enableAutoFallback,
      temperature: config.temperature,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update AI configuration' });
  }
};

// @desc    Test Gemini API connection (Admin only)
// @route   POST /api/ai/test
// @access  Private/Admin
export const testAiConnection = async (req: Request, res: Response) => {
  try {
    const { apiKey: testKey, model: testModel } = req.body;
    const config = await getOrCreateAiConfig();

    // Prioritize passed in key (e.g. testing before saving), otherwise use saved key
    const effectiveKey = (testKey && typeof testKey === 'string' && !testKey.includes('••••'))
      ? testKey.trim()
      : config.geminiApiKey;

    const effectiveModel = (testModel && typeof testModel === 'string')
      ? testModel.trim()
      : (config.selectedModel || 'gemini-2.5-flash');

    if (!effectiveKey) {
      res.status(400).json({
        success: false,
        message: 'No API Key provided. Please enter a valid Gemini API key first.',
      });
      return;
    }

    const startTime = Date.now();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${effectiveKey}`;

    try {
      const response = await axios.post(
        endpoint,
        {
          contents: [
            {
              parts: [{ text: "Respond only with: 'Connection verified successfully.'" }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 20,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
      const latencyMs = Date.now() - startTime;

      config.lastTestedAt = new Date();
      config.lastTestStatus = 'success';
      config.lastTestError = undefined;
      await config.save();

      res.json({
        success: true,
        message: `Gemini API connection test passed! Model '${effectiveModel}' responded in ${latencyMs}ms.`,
        reply: replyText,
        latencyMs,
        model: effectiveModel,
      });
    } catch (apiErr: any) {
      const errorData = apiErr.response?.data?.error;
      const errorMessage = errorData?.message || apiErr.message || 'Unknown error communicating with Gemini API';
      const statusCode = apiErr.response?.status || 500;

      config.lastTestedAt = new Date();
      config.lastTestStatus = 'failed';
      config.lastTestError = errorMessage;
      await config.save();

      res.status(400).json({
        success: false,
        message: `Gemini Test Failed: ${errorMessage}`,
        details: errorData || apiErr.toString(),
        statusCode,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal error while testing Gemini API',
    });
  }
};

// @desc    Draft or Polish notification with Gemini AI (Admin only)
// @route   POST /api/ai/assist
// @access  Private/Admin
export const assistNotification = async (req: Request, res: Response) => {
  try {
    const { mode, prompt, currentSubject, currentMessage } = req.body;
    const config = await getOrCreateAiConfig();

    if (!config.geminiApiKey) {
      res.status(400).json({
        success: false,
        message: 'Gemini API key is not configured. Please go to AI Settings and add your API key.',
      });
      return;
    }

    const primaryModel = config.selectedModel || 'gemini-2.5-flash';

    let systemInstruction = '';
    let userContent = '';

    if (mode === 'draft') {
      if (!prompt || !prompt.trim()) {
        res.status(400).json({ success: false, message: 'Please provide a prompt describing what you want to notify users about.' });
        return;
      }

      systemInstruction = `You are the lead communications specialist for DriveFlow, a high-performance cloud storage and file management platform.
Your task is to draft a professional, clear notification and email announcement based on the administrator's request.
CRITICAL DELIVERABILITY RULES (GMAIL PRIMARY INBOX COMPLIANCE):
1. Subject must be clean, informative, and transactional. Use professional prefixes like "System Notice: ...", "Account Notice: ...", or "Update Advisory: ...".
2. NEVER use promotional hype or spam trigger words like FREE, ACT NOW, HURRY, EXCLUSIVE, BEST DEAL, WINNER, LIMITED OFFER.
3. Message body must be polite, concise, professional, with bullet points where appropriate.
4. Output MUST be valid, parseable JSON with exactly two fields: "subject" and "message".
Example:
{
  "subject": "System Notice: Scheduled Storage Infrastructure Upgrade",
  "message": "Hello,\\n\\nPlease be advised that DriveFlow will undergo scheduled storage upgrades...\\n\\nBest regards,\\nDriveFlow Operations"
}`;
      userContent = `Create a notification draft for: ${prompt.trim()}`;
    } else if (mode === 'polish') {
      if (!currentMessage || !currentMessage.trim()) {
        res.status(400).json({ success: false, message: 'Message body text is empty. Please enter some text to polish.' });
        return;
      }

      systemInstruction = `You are an expert copy editor for DriveFlow cloud platform.
Your task is to refine, grammar-check, and elevate the provided email draft.
CRITICAL DELIVERABILITY RULES:
1. Ensure the tone is clear, authoritative, and helpful.
2. Remove any grammar, spelling, or punctuation errors.
3. Remove any spam triggers or overly promotional phrasing so the email lands directly in Gmail's Primary Inbox.
4. Output MUST be valid, parseable JSON with exactly two fields: "subject" and "message".`;
      userContent = `Subject: ${currentSubject || ''}\n\nMessage Body:\n${currentMessage}`;
    } else {
      res.status(400).json({ success: false, message: "Invalid mode. Must be 'draft' or 'polish'." });
      return;
    }

    // Determine list of models to try (primary first, then fallback pool if enabled)
    const modelsToTry: string[] = [primaryModel];

    if (config.enableAutoFallback !== false) {
      const fallbackCandidates = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-pro',
        'gemini-2.5-pro',
        'gemini-1.5-flash-8b',
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
              maxOutputTokens: 1024,
            },
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 25000,
          }
        );

        const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

        let parsedResult: { subject?: string; message?: string } = {};
        try {
          parsedResult = JSON.parse(cleanJson);
        } catch (parseError) {
          parsedResult = {
            subject: currentSubject || 'DriveFlow System Notice',
            message: rawText,
          };
        }

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

    if (!successfulResult) {
      const errorData = lastError?.response?.data?.error;
      const errorMessage = errorData?.message || lastError?.message || 'Gemini AI call failed across all tried models';
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
