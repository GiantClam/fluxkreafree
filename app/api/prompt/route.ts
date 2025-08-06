import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import { z } from "zod";

import { env } from "@/env.mjs";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";

const CreatePromptSchema = z.object({
  prompt: z.string(),
});

// 使用 AI Gateway 调用 Gemini，无需单独的客户端

const ratelimit = new KVRateLimit(kv, {
  limit: 2,
  window: "5s"
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log("❌ 用户未认证，返回401错误");
      return NextResponse.json({ 
        error: "Authentication required. Please sign in to use the prompt generator." 
      }, { status: 401 });
    }
    const userId = user.id;
    console.log("✅ 用户认证成功:", { userId: user.id, email: user.email });
  } catch (error) {
    console.error("❌ 认证过程出错:", error);
    return NextResponse.json({ 
      error: "Authentication error. Please try signing in again." 
    }, { status: 401 });
  }

  const { success } = await ratelimit.limit(
    "get-prompt:redeemed" + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const data = await req.json();
    const { prompt } = CreatePromptSchema.parse(data);
    
    console.log("🔧 开始生成提示词:", { 
      userInput: prompt,
      model: env.GEMINI_MODEL,
      systemPrompt: env.FLUX_AI_PROMPT?.substring(0, 100) + "...",
      gatewayUrl: env.CLOUDFLARE_AI_GATEWAY_URL
    });
    
    // 使用 AI Gateway 调用 Gemini
    const response = await aiGateway.generateTextViaGemini({
      messages: [
        {
          role: "system",
          content: env.FLUX_AI_PROMPT,
        },
        { role: "user", content: prompt },
      ],
      model: env.GEMINI_MODEL,
      temperature: 0.7,
      max_tokens: 1000,
    });

    console.log("✅ 提示词生成成功:", { 
      responseLength: response.choices?.[0]?.message?.content?.length || 0 
    });

    return NextResponse.json(
      {
        prompt: response.choices?.[0]?.message?.content ?? "",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("❌ 提示词生成失败:", error);
    console.error("❌ 错误详情:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
