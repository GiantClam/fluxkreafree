import { env } from "@/env.mjs";

/**
 * AI Gateway 客户端
 * 用于与 Cloudflare AI Gateway 交互，支持 Replicate 和 Gemini 模型
 */
export class AIGateway {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.CLOUDFLARE_AI_GATEWAY_URL;
    if (!this.baseUrl) {
      throw new Error("CLOUDFLARE_AI_GATEWAY_URL is not configured");
    }
  }

  /**
   * 通过 Replicate 生成图像
   */
  async generateImageViaReplicate(prompt: string, options: {
    model?: string;
    aspectRatio?: string;
    steps?: number;
    guidance?: number;
    seed?: number;
    safetyTolerance?: number;
    loraUrl?: string;
    loraName?: string;
    loraScale?: number;
  } = {}) {
    const {
      model = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      aspectRatio = "1:1",
      steps = 20,
      guidance = 7,
      seed,
      safetyTolerance = 7,
      loraUrl,
      loraName,
      loraScale = 0.8
    } = options;

    const payload = {
      model,
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        num_inference_steps: steps,
        guidance_scale: guidance,
        ...(seed !== undefined && { seed }),
        safety_tolerance: safetyTolerance,
        ...(loraUrl && loraName && {
          lora_weights: loraUrl,
          lora_trigger_word: loraName,
          lora_scale: loraScale
        })
      }
    };

    const response = await fetch(`${this.baseUrl}/replicate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 通过 Gemini 生成文本
   */
  async generateTextViaGemini(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}) {
    const {
      model = env.GEMINI_MODEL || "gemini-2.5-flash",
      maxTokens = 1000,
      temperature = 0.7
    } = options;

    const payload = {
      model,
      input: {
        prompt,
        max_tokens: maxTokens,
        temperature
      }
    };

    const response = await fetch(`${this.baseUrl}/gemini`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string) {
    const response = await fetch(`${this.baseUrl}/task/${taskId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Task status API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      return {
        status: response.ok ? "healthy" : "unhealthy",
        statusCode: response.status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// 导出默认实例
export const aiGateway = new AIGateway(); 