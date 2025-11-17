import { NextResponse, type NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { withRetry, prisma } from "@/lib/db-connection";
import { env } from "@/env.mjs";
import { runningHubService } from "@/lib/runninghub";
import { model } from "@/config/constants";

export async function POST(req: NextRequest) {
  try {
    console.log("🚀 RunningHub Webhook 开始处理");
    console.log("🔍 环境检查:", {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: !!process.env.DATABASE_URL,
      timestamp: new Date().toISOString()
    });

    const body = await req.json();
    console.log("📨 RunningHub Webhook 数据:", {
      taskId: body.taskId,
      status: body.status,
      hasOutput: !!body.output,
      hasError: !!body.error
    });
    
    // 验证 webhook 签名（如果配置了）
    if (env.RUNNINGHUB_WEBHOOK_SECRET) {
      // TODO: 在生产环境中验证 webhook 签名
      // const signature = req.headers.get('runninghub-signature');
      // if (signature) {
      //   const isValid = verifyWebhookSignature(body, signature, env.RUNNINGHUB_WEBHOOK_SECRET);
      //   if (!isValid) {
      //     return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      //   }
      // }
    }
    
    const taskId = body.taskId || body.id;
    if (!taskId) {
      console.warn("⚠️ Webhook 缺少 taskId");
      return NextResponse.json({ 
        message: "Missing taskId" 
      }, { status: 200 });
    }
    
    // 查找对应的 FluxData 记录
    console.log(`🔍 查找 FluxData 记录，replicateId (RunningHub taskId): ${taskId}`);
    let fluxData;
    try {
      fluxData = await withRetry(async () => {
        return await prisma.fluxData.findFirst({
          where: {
            replicateId: taskId, // 复用 replicateId 字段存储 RunningHub taskId
            model: model.clothingTryon, // 确保是 clothing-tryon 模型
          },
        });
      });
    } catch (dbError: any) {
      console.error("❌ 数据库查询失败:", {
        error: dbError.message,
        taskId: taskId
      });
      return NextResponse.json({ 
        message: "Database query failed, but webhook received",
        error: dbError.message
      }, { status: 200 });
    }
    
    if (!fluxData) {
      console.warn(`⚠️ 未找到对应的 FluxData 记录，taskId: ${taskId}`);
      return NextResponse.json({ 
        message: "Task not found, but webhook received" 
      }, { status: 200 });
    }
    
    // 根据 RunningHub 状态更新数据库
    let updateData: any = {};
    
    // RunningHub 状态映射：
    // - "SUCCESS" -> "Succeeded"
    // - "FAILED" -> "Failed"
    // - "RUNNING" / "QUEUED" / "PENDING" -> "Processing"
    const status = body.status || body.taskStatus;
    
    switch (status?.toUpperCase()) {
      case "SUCCESS":
      case "SUCCEEDED":
        // 获取任务结果并上传到 R2
        try {
          console.log(`📥 任务成功，获取结果并上传到 R2: ${taskId}`);
          const resultUrl = await runningHubService.downloadTaskResultAndUploadToR2(
            taskId,
            fluxData.id
          );
          
          updateData = {
            taskStatus: "Succeeded",
            imageUrl: resultUrl,
            executeEndTime: BigInt(Date.now()),
          };
          console.log(`✅ 任务成功完成: ${taskId}，图片URL: ${resultUrl}`);
        } catch (resultError: any) {
          console.error(`❌ 获取任务结果失败: ${resultError.message}`);
          // 即使获取结果失败，也更新状态为成功（结果可能稍后通过轮询获取）
          updateData = {
            taskStatus: "Succeeded",
            executeEndTime: BigInt(Date.now()),
            errorMsg: `获取结果失败: ${resultError.message}`,
          };
        }
        break;
        
      case "FAILED":
      case "FAILURE":
        const errorMsg = body.error || body.errorMessage || "Task failed";
        updateData = {
          taskStatus: "Failed",
          executeEndTime: BigInt(Date.now()),
          errorMsg: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg),
        };
        console.log(`❌ 任务失败: ${taskId}，错误: ${updateData.errorMsg}`);
        break;
        
      case "RUNNING":
      case "PROCESSING":
      case "QUEUED":
      case "PENDING":
        updateData = {
          taskStatus: "Processing",
        };
        console.log(`⚙️ 任务处理中: ${taskId}`);
        break;
        
      default:
        console.log(`ℹ️ 未知状态: ${status} for ${taskId}`);
        return NextResponse.json({ 
          message: "Unknown status" 
        }, { status: 200 });
    }
    
    // 更新数据库记录
    try {
      await withRetry(async () => {
        return await prisma.fluxData.update({
          where: { id: fluxData.id },
          data: updateData,
        });
      });
      console.log(`🔄 已更新 FluxData 记录: ${fluxData.id}，状态: ${updateData.taskStatus}`);
    } catch (dbError: any) {
      console.error("❌ 数据库更新失败:", {
        error: dbError.message,
        fluxDataId: fluxData.id,
        updateData: updateData
      });
      return NextResponse.json(
        { error: "Database update failed", details: dbError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      message: "Webhook processed successfully",
      fluxDataId: fluxData.id,
      status: updateData.taskStatus
    }, { status: 200 });
    
  } catch (error: any) {
    console.error("❌ RunningHub Webhook 详细错误:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

