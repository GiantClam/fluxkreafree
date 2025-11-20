import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";
import { model } from "@/config/constants";
import { Credits } from "@/config/constants";
import { getUserCredit } from "@/db/queries/account";
import { prisma, withRetry } from "@/lib/db-connection";
import { aiGateway } from "@/lib/ai-gateway";
import { z } from "zod";
import { Ratio } from "@/config/constants";
import { FluxHashids } from "@/db/dto/flux.dto";
import { BillingType } from "@/db/type";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

const CreateBatchGenerateSchema = z.object({
  model: z.enum([
    model.pro,
    model.schnell,
    model.dev,
    model.general,
    model.freeSchnell,
    model.kreaDev,
    model.clothingTryon,
  ]),
  userPhotoUrl: z.string().url(),
  topClothesUrls: z.array(z.string().url()).optional().default([]),
  bottomClothesUrls: z.array(z.string().url()).optional().default([]),
  isPrivate: z.number().default(0),
  locale: z.string().default("en"),
});

export async function POST(req: NextRequest) {
  // 在构建时跳过数据库查询
  if (shouldSkipDatabaseQuery()) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;
  const modelName = model.clothingTryon;

  try {
    const data = await req.json();
    const validatedData = CreateBatchGenerateSchema.parse(data);
    
    const { userPhotoUrl, topClothesUrls = [], bottomClothesUrls = [], isPrivate, locale } = validatedData;

    // 验证至少有一件衣服
    if (topClothesUrls.length === 0 && bottomClothesUrls.length === 0) {
      // 根据 locale 返回对应的错误消息
      const errorMessages: Record<string, string> = {
        en: "At least one clothing item (top or bottom) is required",
        zh: "至少需要提供一件衣服（上衣或下衣）",
        tw: "至少需要提供一件衣服（上衣或下衣）",
        ja: "少なくとも1つの衣類アイテム（上着または下着）が必要です",
        ko: "최소 하나의 의류 항목(상의 또는 하의)이 필요합니다",
        fr: "Au moins un article de vêtement (haut ou bas) est requis",
        de: "Mindestens ein Kleidungsstück (Oberteil oder Unterteil) ist erforderlich",
        pt: "Pelo menos um item de roupa (superior ou inferior) é necessário",
        es: "Se requiere al menos un artículo de ropa (superior o inferior)",
        ar: "يُطلب عنصر ملابس واحد على الأقل (أعلى أو أسفل)",
      };
      return NextResponse.json(
        { error: errorMessages[locale] || errorMessages.en },
        { status: 400 },
      );
    }

    // 按照数组索引匹配上衣和下衣
    // 如果同时有 top 和 bottom，则匹配为一对（使用 TOP_BOTTOM 工作流）
    // 如果只有 top 或只有 bottom，则单独处理（使用 SINGLE_ITEM 工作流）
    const maxLength = Math.max(topClothesUrls.length, bottomClothesUrls.length);
    
    // 计算总任务数和所需积分
    const totalTasks = maxLength;
    const needCredit = Credits[modelName] * totalTasks;

    // 获取用户积分
    let account;
    try {
      account = await getUserCredit(userId);
    } catch (error: any) {
      if (error?.code === 'USER_NOT_FOUND' || error?.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: "User not found. Please sign in again.", code: 1000401 },
          { status: 401 },
        );
      }
      throw error;
    }

    // 检查积分是否足够
    if (account.credit < needCredit) {
      return NextResponse.json(
        { error: "Insufficient credit", code: 1000402 },
        { status: 400 },
      );
    }

    // 创建所有任务记录（按照索引匹配）
    type TaskRecord = {
      id: number;
      topClothesUrl?: string;
      bottomClothesUrl?: string;
    };
    const taskRecords: TaskRecord[] = [];
    
    // 按照索引匹配上衣和下衣
    for (let i = 0; i < maxLength; i++) {
      const topClothesUrl = topClothesUrls[i];
      const bottomClothesUrl = bottomClothesUrls[i];
      
      // 至少需要有一件衣服（上衣或下衣）
      if (!topClothesUrl && !bottomClothesUrl) {
        continue; // 跳过空索引
      }
      
      const fluxData = await withRetry(async () => {
        return await prisma.fluxData.create({
          data: {
            userId,
            replicateId: "", // 暂时留空，等任务执行时更新
            inputPrompt: "", // clothing-tryon 不需要 prompt
            executePrompt: "",
            model: modelName,
            aspectRatio: Ratio.r1, // 默认值
            taskStatus: "Processing", // 初始状态为 Processing，replicateId 为空表示在队列中等待执行
            executeStartTime: BigInt(Date.now()),
            locale,
            isPrivate: Boolean(isPrivate),
          },
        });
      });
      
      taskRecords.push({
        id: fluxData.id,
        topClothesUrl: topClothesUrl,
        bottomClothesUrl: bottomClothesUrl,
      });
    }

    // 顺序执行任务（不阻塞响应）
    // 使用异步函数顺序执行，避免并发问题和 TASK_QUEUE_MAXED 错误
    (async () => {
      // 先获取 userCredit 的 id，用于后续更新操作
      const userCreditRecord = await withRetry(async () => {
        return await prisma.userCredit.findFirst({
          where: { userId },
        });
      });
      
      if (!userCreditRecord) {
        console.error(`❌ 用户 ${userId} 的积分记录不存在`);
        return;
      }
      
      const userCreditId = userCreditRecord.id;
      
      // 逐个处理任务，等待前一个任务创建成功后再创建下一个
      for (let i = 0; i < taskRecords.length; i++) {
        const task = taskRecords[i];
        let retryCount = 0;
        const maxRetries = 5;
        const retryDelay = 3000; // 3秒
        
        while (retryCount < maxRetries) {
          try {
            // 更新任务状态为 Processing
            await withRetry(async () => {
              return await prisma.fluxData.update({
                where: { id: task.id },
                data: { taskStatus: "Processing" },
              });
            });

            // 调用 RunningHub 创建任务（先创建任务，成功后再扣费）
            const res = await aiGateway.generateImageViaRunningHub({
              userPhotoUrl,
              topClothesUrl: task.topClothesUrl,
              bottomClothesUrl: task.bottomClothesUrl,
              is_private: Number(isPrivate) || 0,
              user_id: userId,
              locale,
            });

            if (!res?.runninghub_task_id && res.error) {
              // 检查是否是队列满的错误
              if (res.error.includes("TASK_QUEUE_MAXED") || res.error.includes("QUEUE_MAXED")) {
                retryCount++;
                if (retryCount < maxRetries) {
                  console.log(`⏳ 任务队列已满，等待 ${retryDelay}ms 后重试 (${retryCount}/${maxRetries})...`);
                  await new Promise(resolve => setTimeout(resolve, retryDelay));
                  continue; // 重试（不扣费，因为任务还没创建成功）
                } else {
                  // 达到最大重试次数，标记为失败（不扣费）
                  await withRetry(async () => {
                    await prisma.fluxData.update({
                      where: { id: task.id },
                      data: {
                        taskStatus: "Failed",
                        errorMsg: res.error || "Create RunningHub Task Error: Queue maxed out",
                      },
                    });
                  });
                  console.error(`❌ 批量任务 ${i + 1}/${taskRecords.length} 创建失败（队列已满，已达到最大重试次数）`);
                  break; // 跳出重试循环，继续下一个任务
                }
              } else {
                // 其他错误，直接失败（不扣费）
                await withRetry(async () => {
                  await prisma.fluxData.update({
                    where: { id: task.id },
                    data: {
                      taskStatus: "Failed",
                      errorMsg: res.error || "Create RunningHub Task Error",
                    },
                  });
                });
                console.error(`❌ 批量任务 ${i + 1}/${taskRecords.length} 创建失败:`, res.error);
                break; // 跳出重试循环，继续下一个任务
              }
            } else {
              // 任务创建成功，扣除积分并创建账单记录（每个任务单独扣除）
              await withRetry(async () => {
                return await prisma.$transaction(async (tx) => {
                  // 扣除积分
                  await tx.userCredit.update({
                    where: { id: userCreditId },
                    data: {
                      credit: {
                        decrement: Credits[modelName],
                      },
                    },
                  });
                  
                  // 创建账单记录
                  const billing = await tx.userBilling.create({
                    data: {
                      userId,
                      fluxId: task.id,
                      state: "Done",
                      amount: -Credits[modelName],
                      type: BillingType.Withdraw,
                      description: `Generate ${modelName} - Batch Task ${i + 1} Withdraw`,
                    },
                  });
                  
                  // 创建积分交易记录
                  const userCreditRecord = await tx.userCredit.findUnique({
                    where: { id: userCreditId },
                  });
                  
                  await tx.userCreditTransaction.create({
                    data: {
                      userId,
                      credit: -Credits[modelName],
                      balance: (userCreditRecord?.credit || 0) - Credits[modelName],
                      billingId: billing.id,
                      type: "Generate",
                    },
                  });
                });
              });

              // 更新任务记录
              await withRetry(async () => {
                return await prisma.fluxData.update({
                  where: { id: task.id },
                  data: {
                    replicateId: res.runninghub_task_id,
                    taskStatus: "Processing", // 确保状态为 Processing
                  },
                });
              });

              console.log(`✅ 批量任务 ${i + 1}/${taskRecords.length} 创建成功并已扣费，task_id: ${res.runninghub_task_id}`);
              
              // 等待前一个任务进入 RunningHub 队列后再创建下一个任务
              // 这样可以避免连续创建任务导致队列满
              if (i < taskRecords.length - 1) {
                // 轮询任务状态，等待任务进入队列（状态变为 RUNNING 或 QUEUED）
                let pollCount = 0;
                const maxPolls = 10; // 最多轮询10次
                const pollDelay = 2000; // 每次轮询间隔2秒
                
                while (pollCount < maxPolls) {
                  try {
                    const taskStatus = await aiGateway.getRunningHubTaskStatus(res.runninghub_task_id);
                    const status = taskStatus?.data?.taskStatus || taskStatus?.data?.status || taskStatus?.data;
                    
                    // 如果任务状态是 RUNNING、QUEUED 或 PROCESSING，说明已经进入队列
                    if (status && (status.toUpperCase().includes("RUNNING") || 
                                    status.toUpperCase().includes("QUEUED") || 
                                    status.toUpperCase().includes("PROCESSING"))) {
                      console.log(`✅ 任务 ${res.runninghub_task_id} 已进入队列，状态: ${status}`);
                      break; // 跳出轮询，继续下一个任务
                    }
                    
                    // 如果任务已经完成或失败，也跳出轮询
                    if (status && (status.toUpperCase().includes("SUCCESS") || 
                                    status.toUpperCase().includes("FAILED"))) {
                      console.log(`ℹ️ 任务 ${res.runninghub_task_id} 已完成，状态: ${status}`);
                      break;
                    }
                    
                    pollCount++;
                    if (pollCount < maxPolls) {
                      console.log(`⏳ 等待任务 ${res.runninghub_task_id} 进入队列... (${pollCount}/${maxPolls})`);
                      await new Promise(resolve => setTimeout(resolve, pollDelay));
                    }
                  } catch (pollError: any) {
                    // 轮询失败，等待一段时间后继续下一个任务
                    console.warn(`⚠️ 轮询任务状态失败: ${pollError.message}，等待 ${pollDelay}ms 后继续下一个任务`);
                    await new Promise(resolve => setTimeout(resolve, pollDelay));
                    break;
                  }
                }
                
                // 如果轮询超时，仍然等待一段时间再继续下一个任务
                if (pollCount >= maxPolls) {
                  console.log(`⏳ 轮询超时，等待 ${pollDelay}ms 后继续下一个任务`);
                  await new Promise(resolve => setTimeout(resolve, pollDelay));
                }
              }
              
              break; // 成功，跳出重试循环，继续下一个任务
            }
          } catch (error: any) {
            // 检查是否是队列满的错误
            if (error?.message?.includes("TASK_QUEUE_MAXED") || error?.message?.includes("QUEUE_MAXED")) {
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`⏳ 任务队列已满，等待 ${retryDelay}ms 后重试 (${retryCount}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue; // 重试（不扣费，因为任务还没创建成功）
              } else {
                // 达到最大重试次数，标记为失败（不扣费）
                await withRetry(async () => {
                  await prisma.fluxData.update({
                    where: { id: task.id },
                    data: {
                      taskStatus: "Failed",
                      errorMsg: error?.message || "Task execution failed: Queue maxed out",
                    },
                  });
                });
                console.error(`❌ 批量任务 ${i + 1}/${taskRecords.length} 执行失败（队列已满，已达到最大重试次数）:`, error);
                break; // 跳出重试循环，继续下一个任务
              }
            } else {
              // 其他错误，直接失败（不扣费）
              console.error(`❌ 批量任务 ${i + 1}/${taskRecords.length} 执行失败:`, error);
              await withRetry(async () => {
                await prisma.fluxData.update({
                  where: { id: task.id },
                  data: {
                    taskStatus: "Failed",
                    errorMsg: error?.message || "Task execution failed",
                  },
                });
              });
              break; // 跳出重试循环，继续下一个任务
            }
          }
        }
      }
    })();

    // 返回创建的任务列表（使用编码后的 ID）
    return NextResponse.json({
      data: taskRecords.map(task => ({
        id: FluxHashids.encode(task.id),
      })),
    });
  } catch (error: any) {
    console.error("批量任务创建失败:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create batch tasks" },
      { status: 400 },
    );
  }
}

