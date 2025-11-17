import { NextResponse, type NextRequest } from "next/server";
import { withRetry, prisma } from "@/lib/db-connection";
import { aiGateway } from "@/lib/ai-gateway";
import { model } from "@/config/constants";
import { getErrorMessage } from "@/lib/handle-error";
import { 
  syncTasksBatch, 
  createRunningHubStatusProvider,
  createReplicateStatusProvider 
} from "@/modules/tasks";
import { createFluxTaskRepository, fluxDataToTaskRecord } from "@/lib/adapters/flux-task-repository";
import { runningHubService } from "@/lib/runninghub";

/**
 * 定时任务：定期检查并更新处理中的任务状态
 * 可以通过 Vercel Cron Jobs 或外部 cron 服务调用
 * 
 * 使用方法（Vercel）：
 * 在 vercel.json 中添加：
 * {
 *   "crons": [{
 *     "path": "/api/cron/task-sync",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 * 
 * 注意：schedule 使用标准 cron 格式，例如 "0 * * * *" 表示每小时执行一次
 */
export async function GET(req: NextRequest) {
  // 验证请求来源（可选：添加 API key 验证）
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🔄 开始同步处理中的任务状态...");
    
    // 查找所有处理中的任务（最近 1 小时内的）
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const processingTasks = await withRetry(async () => {
      return await prisma.fluxData.findMany({
        where: {
          taskStatus: "Processing",
          replicateId: { not: "" }, // 检查 replicateId 不为空字符串
          executeStartTime: {
            gte: BigInt(oneHourAgo.getTime()),
          },
        },
        select: {
          id: true,
          userId: true,
          replicateId: true,
          taskStatus: true,
          model: true,
          inputPrompt: true,
          imageUrl: true,
          errorMsg: true,
        },
        take: 50, // 每次最多处理 50 个任务
      });
    });

    console.log(`📋 找到 ${processingTasks.length} 个处理中的任务`);

    // 转换为 TaskRecord 格式
    const taskRecords = processingTasks
      .filter(task => task.replicateId) // 过滤掉没有 externalTaskId 的任务
      .map(task => fluxDataToTaskRecord({
        id: task.id,
        userId: task.userId,
        model: task.model,
        taskStatus: task.taskStatus,
        inputPrompt: task.inputPrompt,
        imageUrl: task.imageUrl,
        replicateId: task.replicateId!,
        errorMsg: task.errorMsg,
      }));

    // 按任务类型分组
    const runningHubTasks = taskRecords.filter(t => t.model === model.clothingTryon);
    const replicateTasks = taskRecords.filter(t => t.model !== model.clothingTryon);

    const repository = createFluxTaskRepository();
    const allResults = {
      total: taskRecords.length,
      updated: 0,
      succeeded: 0,
      failed: 0,
      stillProcessing: 0,
      errors: [] as string[],
    };

    // 同步 RunningHub 任务
    if (runningHubTasks.length > 0) {
      const runningHubProvider = createRunningHubStatusProvider({
        getTaskStatus: (taskId) => aiGateway.getRunningHubTaskStatus(taskId),
        getTaskResult: (taskId) => runningHubService.getTaskResult(taskId),
      });

      const runningHubResults = await syncTasksBatch(
        runningHubTasks,
        runningHubProvider,
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
              
              // 下载结果并上传到 R2
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

      allResults.updated += runningHubResults.updated;
      allResults.succeeded += runningHubResults.succeeded;
      allResults.failed += runningHubResults.failed;
      allResults.stillProcessing += runningHubResults.stillProcessing;
      allResults.errors.push(...runningHubResults.errors);
    }

    // 同步 Replicate 任务
    if (replicateTasks.length > 0) {
      const replicateProvider = createReplicateStatusProvider({
        getTaskStatus: (predictionId) => aiGateway.getTaskStatus(predictionId),
      });

      const replicateResults = await syncTasksBatch(
        replicateTasks,
        replicateProvider,
        repository
      );

      allResults.updated += replicateResults.updated;
      allResults.succeeded += replicateResults.succeeded;
      allResults.failed += replicateResults.failed;
      allResults.stillProcessing += replicateResults.stillProcessing;
      allResults.errors.push(...replicateResults.errors);
    }

    const results = allResults;

    console.log(`✅ 任务同步完成:`, {
      total: results.total,
      updated: results.updated,
      succeeded: results.succeeded,
      failed: results.failed,
      stillProcessing: results.stillProcessing,
      errorsCount: results.errors.length,
    });

    return NextResponse.json({
      success: true,
      message: "Task sync completed",
      results,
    });
  } catch (error) {
    console.error("❌ 任务同步失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

