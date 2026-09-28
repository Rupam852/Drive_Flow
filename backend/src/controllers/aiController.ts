import { Request, Response } from 'express';
import axios from 'axios';
import { AiConfig } from '../models/AiConfig';
import { logActivity } from '../utils/logger';

const DEFAULT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
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

  const doc = config;
  let modified = false;

  // Reset to default if saved model is one of our old fake/non-existent 3.x models
  if (!doc.selectedModel || doc.selectedModel.startsWith('gemini-3.')) {
    doc.selectedModel = 'gemini-2.5-flash';
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
    const modelsToTry: string[] = [primaryModel];

    if (config.enableAutoFallback !== false) {
      const fallbackCandidates = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite-preview-06-17',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
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
