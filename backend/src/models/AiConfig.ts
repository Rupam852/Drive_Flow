import mongoose, { Document, Schema } from 'mongoose';

export interface IAiConfig extends Document {
  geminiApiKey: string;
  selectedModel: string;
  availableModels: string[];
  enableAutoFallback: boolean;
  temperature: number;
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
