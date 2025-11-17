/**
 * FluxData 任务仓库适配器
 * 将 FluxData 模型适配为 TaskRepository 接口
 */

import { TaskRepository, TaskRecord } from "@/modules/tasks";
import { prisma } from "@/lib/db-connection";
import { withRetry } from "@/lib/db-connection";

/**
 * 创建 FluxData 任务仓库适配器
 */
export function createFluxTaskRepository(): TaskRepository {
  return {
    async create(data) {
      const fluxData = await withRetry(async () => {
        return await prisma.fluxData.create({
          data: {
            userId: data.userId || "",
            model: data.model,
            inputPrompt: data.inputUrl || "",
            taskStatus: (data.status as any) || "Processing",
            replicateId: "", // 创建时还没有外部任务 ID，后续通过 update 设置
            imageUrl: undefined, // 创建时还没有输出
            errorMsg: undefined, // 创建时还没有错误
            aspectRatio: "1:1", // 默认值，因为 schema 中 aspectRatio 是必需的
          },
        });
      });

      return {
        id: fluxData.id,
        userId: fluxData.userId,
        model: fluxData.model,
        status: fluxData.taskStatus,
        inputUrl: fluxData.inputPrompt || null,
        outputUrl: fluxData.imageUrl || null,
        externalTaskId: fluxData.replicateId || null,
        errorMsg: fluxData.errorMsg || null,
      };
    },

    async update(id, data) {
      await withRetry(async () => {
        // 确保状态格式正确（数据库使用 "Succeeded", "Failed", "Processing"）
        const taskStatus = data.status === "succeeded" ? "Succeeded"
                        : data.status === "failed" ? "Failed"
                        : data.status === "processing" ? "Processing"
                        : data.status === "queued" ? "Processing"
                        : data.status === "pending" ? "Processing"
                        : (data.status as any) || "Processing";
        
        return await prisma.fluxData.update({
          where: { id: typeof id === "number" ? id : parseInt(String(id)) },
          data: {
            taskStatus: taskStatus,
            imageUrl: data.outputUrl || undefined,
            errorMsg: data.errorMsg || undefined,
            replicateId: data.externalTaskId || undefined,
            executeEndTime: taskStatus === "Succeeded" || taskStatus === "Failed" 
              ? BigInt(Date.now()) 
              : undefined,
          },
        });
      });
    },

    async findByExternalId(model, externalId) {
      const fluxData = await withRetry(async () => {
        return await prisma.fluxData.findFirst({
          where: {
            model,
            replicateId: externalId,
          },
        });
      });

      if (!fluxData) return null;

      return {
        id: fluxData.id,
        userId: fluxData.userId,
        model: fluxData.model,
        status: fluxData.taskStatus,
        inputUrl: fluxData.inputPrompt || null,
        outputUrl: fluxData.imageUrl || null,
        externalTaskId: fluxData.replicateId || null,
        errorMsg: fluxData.errorMsg || null,
      };
    },
  };
}

/**
 * 将 FluxData 转换为 TaskRecord
 */
export function fluxDataToTaskRecord(fluxData: {
  id: number;
  userId: string | null;
  model: string;
  taskStatus: string;
  inputPrompt: string | null;
  imageUrl: string | null;
  replicateId: string | null;
  errorMsg: string | null;
}): TaskRecord {
  return {
    id: fluxData.id,
    userId: fluxData.userId,
    model: fluxData.model,
    status: fluxData.taskStatus,
    inputUrl: fluxData.inputPrompt || null,
    outputUrl: fluxData.imageUrl || null,
    externalTaskId: fluxData.replicateId || null,
    errorMsg: fluxData.errorMsg || null,
  };
}

