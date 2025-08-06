import { model } from "@/config/constants";

/**
 * AI Gateway 工具函数
 */

export interface ModelMapping {
  [key: string]: {
    provider: 'replicate' | 'gemini';
    model: string;
    credits: number;
    description: string;
  };
}

export const modelMappings: ModelMapping = {
  [model.pro]: {
    provider: 'replicate',
    model: 'black-forest-labs/flux-1.1-pro',
    credits: 20,
    description: 'FLUX 1.1 Pro - 最高质量，适合专业用途'
  },
  [model.dev]: {
    provider: 'replicate',
    model: 'black-forest-labs/flux-dev',
    credits: 10,
    description: 'FLUX Dev - 平衡质量和速度'
  },
  [model.schnell]: {
    provider: 'replicate',
    model: 'black-forest-labs/flux-schnell',
    credits: 5,
    description: 'FLUX Schnell - 最快速度，适合快速原型'
  },
  [model.general]: {
    provider: 'replicate',
    model: 'black-forest-labs/flux-dev',
    credits: 10,
    description: 'FLUX General - 通用模型，支持 LoRA'
  },
  [model.freeSchnell]: {
    provider: 'replicate',
    model: 'black-forest-labs/flux-schnell',
    credits: 0,
    description: 'FLUX Schnell - 免费版本（每月限制）'
  },
};

export function getModelInfo(modelName: string) {
  return modelMappings[modelName];
}

export function isModelSupported(modelName: string): boolean {
  return modelName in modelMappings;
}

export function formatErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
  return '未知错误';
} 