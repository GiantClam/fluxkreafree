import { NextResponse, type NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { prisma } from "@/db/prisma";
import { env } from "@/env.mjs";

export async function POST(req: NextRequest) {
  try {
    console.log("🚀 Webhook 开始处理");
    console.log("🔍 环境检查:", {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
      prismaType: prisma.constructor.name,
      timestamp: new Date().toISOString()
    });

    const body = await req.json();
    console.log("📨 Webhook 数据:", {
      id: body.id,
      status: body.status,
      hasOutput: !!body.output,
      hasError: !!body.error
    });
    
    // 验证 webhook 签名（生产环境应该验证）
    const signature = req.headers.get('replicate-signature');
    if (env.REPLICATE_WEBHOOK_SECRET && signature) {
      // TODO: 在生产环境中验证 webhook 签名
      // const isValid = verifyWebhookSignature(body, signature, env.REPLICATE_WEBHOOK_SECRET);
      // if (!isValid) {
      //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      // }
    }
    
    console.log("📨 收到 Replicate webhook:", {
      id: body.id,
      status: body.status,
      output: body.output ? "有输出" : "无输出",
      outputType: body.output ? typeof body.output : "undefined",
      logs: body.logs ? "有日志" : "无日志",
      logsType: body.logs ? typeof body.logs : "undefined",
      logsIsArray: body.logs ? Array.isArray(body.logs) : "undefined",
      error: body.error ? "有错误" : "无错误",
      errorType: body.error ? typeof body.error : "undefined"
    });
    
    // 查找对应的 FluxData 记录
    console.log(`🔍 查找 FluxData 记录，replicateId: ${body.id}`);
    let fluxData;
    try {
      fluxData = await prisma.fluxData.findFirst({
        where: {
          replicateId: body.id,
        },
      });
    } catch (dbError) {
      console.error("❌ 数据库查询失败:", {
        error: dbError.message,
        replicateId: body.id
      });
      // 即使数据库查询失败，也返回 200 避免 webhook 重试
      return NextResponse.json({ 
        message: "Database query failed, but webhook received",
        error: dbError.message
      }, { status: 200 });
    }
    
    if (!fluxData) {
      console.warn(`⚠️ 未找到对应的 FluxData 记录，replicateId: ${body.id}`);
      // 返回 200 而不是 404，避免 webhook 重试
      return NextResponse.json({ 
        message: "Task not found, but webhook received" 
      }, { status: 200 });
    }
    
    // 根据 Replicate 状态更新数据库
    let updateData: any = {};
    
    switch (body.status) {
      case "starting":
        updateData = {
          taskStatus: "Processing",
          executeStartTime: BigInt(Date.now()),
        };
        console.log(`🚀 任务开始处理: ${body.id}`);
        break;
        
      case "processing":
        updateData = {
          taskStatus: "Processing",
        };
        console.log(`⚙️ 任务处理中: ${body.id}`);
        break;
        
      case "succeeded":
        const imageUrl = Array.isArray(body.output) ? body.output[0] : body.output;
        
        // 安全处理 logs 字段
        let logsText = "";
        if (body.logs) {
          if (Array.isArray(body.logs)) {
            logsText = body.logs.join("\n");
          } else if (typeof body.logs === "string") {
            logsText = body.logs;
          } else {
            logsText = JSON.stringify(body.logs);
          }
        }
        
        updateData = {
          taskStatus: "Succeeded",
          imageUrl: imageUrl,
          executeEndTime: BigInt(Date.now()),
          errorMsg: logsText,
        };
        console.log(`✅ 任务成功完成: ${body.id}，图片URL: ${imageUrl}`);
        break;
        
      case "failed":
      case "canceled":
        // 安全处理错误信息
        let errorMsg = "Task failed";
        if (body.error) {
          if (typeof body.error === "string") {
            errorMsg = body.error;
          } else if (body.error.message) {
            errorMsg = body.error.message;
          } else {
            errorMsg = JSON.stringify(body.error);
          }
        }
        
        updateData = {
          taskStatus: "Failed",
          executeEndTime: BigInt(Date.now()),
          errorMsg: errorMsg,
        };
        console.log(`❌ 任务失败: ${body.id}，错误: ${updateData.errorMsg}`);
        break;
        
      default:
        console.log(`ℹ️ 未知状态: ${body.status} for ${body.id}`);
        return NextResponse.json({ 
          message: "Unknown status" 
        }, { status: 200 });
    }
    
    // 更新数据库记录
    try {
      await prisma.fluxData.update({
        where: { id: fluxData.id },
        data: updateData,
      });
      console.log(`🔄 已更新 FluxData 记录: ${fluxData.id}，状态: ${updateData.taskStatus}`);
    } catch (dbError) {
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
    
    console.log(`🔄 已更新 FluxData 记录: ${fluxData.id}，状态: ${updateData.taskStatus}`);
    
    return NextResponse.json({ 
      message: "Webhook processed successfully",
      fluxDataId: fluxData.id,
      status: updateData.taskStatus
    }, { status: 200 });
    
  } catch (error) {
    console.error("❌ Webhook 详细错误:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      constructor: error.constructor.name
    });
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
} 