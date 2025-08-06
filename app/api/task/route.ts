import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import { z } from "zod";

import { FluxHashids } from "@/db/dto/flux.dto";
import { prisma } from "@/db/prisma";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";

const ratelimit = new KVRateLimit(kv, {
  limit: 15,
  window: "5s"
});

function getKey(id: string) {
  return `task:query:${id}`;
}

const QueryTaskSchema = z.object({
  fluxId: z.string(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { success } = await ratelimit.limit(getKey(user.id));
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const data = await req.json();
    const { fluxId } = QueryTaskSchema.parse(data);

    const id = FluxHashids.decode(fluxId)?.[0];
    if (!id) {
      return NextResponse.json({ error: "Invalid flux ID" }, { status: 400 });
    }

    const fluxData = await prisma.fluxData.findFirst({
      where: {
        id: Number(id),
        userId: user.id,
      },
      select: {
        id: true,
        replicateId: true,
        taskStatus: true,
        imageUrl: true,
        errorMsg: true,
        executeStartTime: true,
        executeEndTime: true,
        inputPrompt: true,
        model: true,
        aspectRatio: true,
      },
    });

    console.log("📋 数据库查询结果:", {
      id: fluxData?.id,
      replicateId: fluxData?.replicateId,
      taskStatus: fluxData?.taskStatus,
      imageUrl: fluxData?.imageUrl,
      hasImageUrl: !!fluxData?.imageUrl,
      errorMsg: fluxData?.errorMsg
    });

    if (!fluxData) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 如果任务已经完成或失败，直接返回数据库中的结果
    if (fluxData.taskStatus === "Succeeded" || fluxData.taskStatus === "Failed") {
      console.log("📋 任务已完成，返回数据库状态:", {
        id: fluxData.id,
        status: fluxData.taskStatus,
        imageUrl: fluxData.imageUrl,
        hasImageUrl: !!fluxData.imageUrl
      });
      return NextResponse.json({
        data: {
          id: FluxHashids.encode(fluxData.id),
          taskStatus: fluxData.taskStatus.toLowerCase(),
          imageUrl: fluxData.imageUrl,
          error: fluxData.errorMsg,
          prompt: fluxData.inputPrompt,
          model: fluxData.model,
          aspectRatio: fluxData.aspectRatio,
        }
      });
    }

    // 如果任务还在进行中，查询 Replicate 获取最新状态
    if (fluxData.replicateId && fluxData.taskStatus === "Processing") {
      try {
        console.log("🔍 查询 Replicate 任务状态:", fluxData.replicateId);
        console.log("🔍 环境检查:", {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL,
          CLOUDFLARE_AI_GATEWAY_URL: !!process.env.CLOUDFLARE_AI_GATEWAY_URL,
          REPLICATE_API_TOKEN: !!process.env.REPLICATE_API_TOKEN
        });
        
        const replicateResult = await aiGateway.getTaskStatus(fluxData.replicateId);
        console.log("📨 Replicate 响应:", {
          id: replicateResult.id,
          status: replicateResult.status,
          hasOutput: !!replicateResult.output,
          outputType: replicateResult.output ? typeof replicateResult.output : 'undefined'
        });
        
        // 根据 Replicate 返回的状态更新数据库
        let updateData: any = {};
        let responseStatus = fluxData.taskStatus.toLowerCase();
        let imageUrl = fluxData.imageUrl;
        
        switch (replicateResult.status) {
          case "succeeded":
            const resultUrl = Array.isArray(replicateResult.output) 
              ? replicateResult.output[0] 
              : replicateResult.output;
            updateData = {
              taskStatus: "Succeeded",
              imageUrl: resultUrl,
              executeEndTime: BigInt(Date.now()),
            };
            responseStatus = "succeeded";
            imageUrl = resultUrl;
            console.log("✅ 任务已完成，图片URL:", resultUrl);
            break;
            
          case "failed":
          case "canceled":
            updateData = {
              taskStatus: "Failed",
              executeEndTime: BigInt(Date.now()),
              errorMsg: replicateResult.error?.message || replicateResult.error || "Task failed",
            };
            responseStatus = "failed";
            console.log("❌ 任务失败:", updateData.errorMsg);
            break;
            
          case "starting":
          case "processing":
            updateData = {
              taskStatus: "Processing",
            };
            responseStatus = "processing";
            console.log("⚙️ 任务处理中...");
            break;
        }
        
        // 更新数据库
        if (Object.keys(updateData).length > 0) {
          await prisma.fluxData.update({
            where: { id: fluxData.id },
            data: updateData,
          });
        }
        
        return NextResponse.json({
          data: {
            id: FluxHashids.encode(fluxData.id),
            taskStatus: responseStatus,
            imageUrl: imageUrl,
            error: updateData.errorMsg || fluxData.errorMsg,
            prompt: fluxData.inputPrompt,
            model: fluxData.model,
            aspectRatio: fluxData.aspectRatio,
          }
        });
        
      } catch (error) {
        console.error("❌ 查询 Replicate 状态失败:", error);
        // 如果查询失败，返回数据库中的当前状态
        return NextResponse.json({
          data: {
            id: FluxHashids.encode(fluxData.id),
            taskStatus: fluxData.taskStatus.toLowerCase(),
            imageUrl: fluxData.imageUrl,
            error: fluxData.errorMsg || "Failed to query task status",
            prompt: fluxData.inputPrompt,
            model: fluxData.model,
            aspectRatio: fluxData.aspectRatio,
          }
        });
      }
    }

    // 默认返回数据库中的状态
    return NextResponse.json({
      data: {
        id: FluxHashids.encode(fluxData.id),
        taskStatus: fluxData.taskStatus.toLowerCase(),
        imageUrl: fluxData.imageUrl,
        error: fluxData.errorMsg,
        prompt: fluxData.inputPrompt,
        model: fluxData.model,
        aspectRatio: fluxData.aspectRatio,
      }
    });
    
  } catch (error) {
    console.error("Task query error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
