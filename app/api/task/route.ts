import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import { z } from "zod";

import { FluxHashids } from "@/db/dto/flux.dto";
import { withRetry, prisma } from "@/lib/db-connection";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";
import { model } from "@/config/constants";
import { 
  syncTaskStatusGeneric, 
  createRunningHubStatusProvider,
  createReplicateStatusProvider 
} from "@/modules/tasks";
import { createFluxTaskRepository, fluxDataToTaskRecord } from "@/lib/adapters/flux-task-repository";
import { runningHubService } from "@/lib/runninghub";

const ratelimit = new KVRateLimit(kv, {
  limit: 15,
  window: "5s"
});

function getKey(id: string) {
  return `task:query:${id}`;
}

const QueryTaskSchema = z.object({
  fluxId: z.union([z.string(), z.number()]).transform((val) => String(val)),
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

    const fluxData = await withRetry(async () => {
      return await prisma.fluxData.findFirst({
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

    // 如果任务还在进行中，查询任务状态
    if (fluxData.replicateId && fluxData.taskStatus === "Processing") {
      try {
        // 判断是 Replicate 还是 RunningHub 任务
        const isRunningHubTask = fluxData.model === model.clothingTryon;
        
        if (isRunningHubTask) {
          // 使用通用模块同步 RunningHub 任务状态
          console.log("🔍 查询 RunningHub 任务状态:", fluxData.replicateId);
          
          const taskRecord = fluxDataToTaskRecord({
            id: fluxData.id,
            userId: fluxData.userId,
            model: fluxData.model,
            taskStatus: fluxData.taskStatus,
            inputPrompt: fluxData.inputPrompt,
            imageUrl: fluxData.imageUrl,
            replicateId: fluxData.replicateId,
            errorMsg: fluxData.errorMsg,
          });
          
          const repository = createFluxTaskRepository();
          const statusProvider = createRunningHubStatusProvider({
            getTaskStatus: (taskId) => aiGateway.getRunningHubTaskStatus(taskId),
            getTaskResult: (taskId) => runningHubService.getTaskResult(taskId),
          });
          
          const syncResult = await syncTaskStatusGeneric(
            taskRecord,
            statusProvider,
            repository,
            {
              fetchResultOnSuccess: true,
              onResultFetched: async (result, taskRecord) => {
                // 自定义结果处理：下载并上传到 R2
                try {
                  const outputUrl = Array.isArray(result.outputUrl) 
                    ? result.outputUrl[0] 
                    : result.outputUrl;
                  
                  if (!outputUrl) return null;
                  
                  const r2Url = await runningHubService.downloadTaskResultAndUploadToR2(
                    taskRecord.externalTaskId!,
                    typeof taskRecord.id === "number" ? taskRecord.id : parseInt(String(taskRecord.id))
                  );
                  
                  return r2Url;
                } catch (error: any) {
                  console.error(`❌ 处理 RunningHub 任务结果失败: ${error.message}`);
                  return null;
                }
              },
            }
          );
          
          // 重新查询更新后的数据
          const updatedFluxData = await withRetry(async () => {
            return await prisma.fluxData.findFirst({
              where: { id: fluxData.id },
              select: {
                id: true,
                taskStatus: true,
                imageUrl: true,
                errorMsg: true,
                inputPrompt: true,
                model: true,
                aspectRatio: true,
              },
            });
          });
          
          if (!updatedFluxData) {
            throw new Error("Task not found after sync");
          }
          
          // 返回格式与 Replicate 任务保持一致，确保前端能正确识别状态
          return NextResponse.json({
            data: {
              id: FluxHashids.encode(updatedFluxData.id),
              taskStatus: updatedFluxData.taskStatus.toLowerCase(),
              imageUrl: updatedFluxData.imageUrl,
              error: updatedFluxData.errorMsg,
              prompt: updatedFluxData.inputPrompt,
              model: updatedFluxData.model,
              aspectRatio: updatedFluxData.aspectRatio,
            }
          });
        } else {
          // 使用通用模块同步 Replicate 任务状态
          console.log("🔍 查询 Replicate 任务状态:", fluxData.replicateId);
          
          const taskRecord = fluxDataToTaskRecord({
            id: fluxData.id,
            userId: fluxData.userId,
            model: fluxData.model,
            taskStatus: fluxData.taskStatus,
            inputPrompt: fluxData.inputPrompt,
            imageUrl: fluxData.imageUrl,
            replicateId: fluxData.replicateId,
            errorMsg: fluxData.errorMsg,
          });
          
          const repository = createFluxTaskRepository();
          const statusProvider = createReplicateStatusProvider({
            getTaskStatus: (predictionId) => aiGateway.getTaskStatus(predictionId),
          });
          
          const syncResult = await syncTaskStatusGeneric(
            taskRecord,
            statusProvider,
            repository
          );
          
          // 重新查询更新后的数据
          const updatedFluxData = await withRetry(async () => {
            return await prisma.fluxData.findFirst({
              where: { id: fluxData.id },
              select: {
                id: true,
                taskStatus: true,
                imageUrl: true,
                errorMsg: true,
                inputPrompt: true,
                model: true,
                aspectRatio: true,
              },
            });
          });
          
          if (!updatedFluxData) {
            throw new Error("Task not found after sync");
          }
          
          return NextResponse.json({
            data: {
              id: FluxHashids.encode(updatedFluxData.id),
              taskStatus: updatedFluxData.taskStatus.toLowerCase(),
              imageUrl: updatedFluxData.imageUrl,
              error: updatedFluxData.errorMsg,
              prompt: updatedFluxData.inputPrompt,
              model: updatedFluxData.model,
              aspectRatio: updatedFluxData.aspectRatio,
            }
          });
        }
      } catch (error) {
        console.error("❌ 查询任务状态失败:", error);
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
