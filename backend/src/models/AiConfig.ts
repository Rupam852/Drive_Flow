import mongoose, { Document, Schema } from 'mongoose';

export interface IAiConfig extends Document {
  // Gemini settings
  geminiApiKey: string;
  selectedModel: string;
  availableModels: string[];
  enableAutoFallback: boolean;
  temperature: number;
  // NVIDIA fallback settings
  nvidiaApiKey: string;
  enableNvidiaFallback: boolean;
  nvidiaModel: string;
  // Test metadata
  lastTestedAt?: Date;
  lastTestStatus?: 'success' | 'failed';
  lastTestError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiConfigSchema = new Schema<IAiConfig>(
  {
    geminiApiKey: {
      type: String,
      default: '',
    },
    selectedModel: {
      type: String,
      default: 'gemini-3.8-flash',
    },
    availableModels: {
      type: [String],
      default: [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
      ],
    },
    enableAutoFallback: {
      type: Boolean,
      default: true,
    },
    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 2,
    },
    // NVIDIA NIM fallback
    nvidiaApiKey: {
      type: String,
      default: '',
    },
    enableNvidiaFallback: {
      type: Boolean,
      default: false,
    },
    nvidiaModel: {
      type: String,
      default: 'nvidia/nemotron-3-super-120b-a12b',
    },
    // Test metadata
    lastTestedAt: {
      type: Date,
    },
    lastTestStatus: {
      type: String,
      enum: ['success', 'failed'],
    },
    lastTestError: {
      type: String,
    },
  },
  { timestamps: true }
);

export const AiConfig = mongoose.model<IAiConfig>('AiConfig', aiConfigSchema);
