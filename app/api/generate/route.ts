import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import dayjs from "dayjs";
import { z } from "zod";

import { Credits, model, Ratio } from "@/config/constants";
import { FluxHashids } from "@/db/dto/flux.dto";
import { withRetry, prisma } from "@/lib/db-connection";
import { getUserCredit } from "@/db/queries/account";
import { BillingType } from "@/db/type";
import { env } from "@/env.mjs";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "10s"
});

function getKey(id: string) {
  return `generate:${id}`;
}

export const maxDuration = 60;

type Params = { params: { key: string } };
const CreateGenerateSchema = z.object({
  model: z.enum([
    model.pro,
    model.schnell,
    model.dev,
    model.general,
    model.freeSchnell,
    model.kreaDev,
    model.clothingTryon,
  ]),
  inputPrompt: z.string().optional(), // clothing-tryon 不需要 prompt
  aspectRatio: z.enum([
    Ratio.r1,
    Ratio.r2,
    Ratio.r3,
    Ratio.r4,
    Ratio.r5,
    Ratio.r6,
    Ratio.r7,
  ]).optional(), // clothing-tryon 不需要 aspectRatio
  isPrivate: z.number().default(0),
  locale: z.string().default("en"),
  loraName: z.string().optional(),
  inputImageUrl: z.string().url().optional(),
  // clothing-tryon 专用字段
  userPhotoUrl: z.string().url().optional(), // 全身自拍照（必选，但在这里设为optional，在逻辑中验证）
  topClothesUrl: z.string().url().optional(), // 上衣图片（可选）
  bottomClothesUrl: z.string().url().optional(), // 下衣图片（可选）
}).refine((data) => {
  // 对于 clothing-tryon 模型，userPhotoUrl 是必选的
  if (data.model === model.clothingTryon) {
    return !!data.userPhotoUrl;
  }
  // 对于其他模型，inputPrompt 是必选的
  return !!data.inputPrompt;
}, {
  message: "clothing-tryon 模型需要 userPhotoUrl，其他模型需要 inputPrompt"
});

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;

  const { success } = await ratelimit.limit(
    getKey(user.id) + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const data = await req.json();
    const {
      model: modelName,
      inputPrompt,
      aspectRatio,
      isPrivate,
      locale,
      loraName,
      inputImageUrl,
      userPhotoUrl,
      topClothesUrl,
      bottomClothesUrl,
    } = CreateGenerateSchema.parse(data);

    if (modelName === model.freeSchnell) {
      const thisMonthStart = dayjs().startOf("M");
      const thisMonthEnd = dayjs().endOf("M");
      const freeSchnellCount = await withRetry(async () => {
        return await prisma.fluxData.count({
          where: {
            model: model.freeSchnell,
            userId,
            createdAt: {
              gte: thisMonthStart.toDate(),
              lte: thisMonthEnd.toDate(),
            },
          },
        });
      });
      // 5 free schnell generate per month
      if (freeSchnellCount >= 5) {
        return NextResponse.json(
          { error: "Insufficient credit", code: 1000403 },
          { status: 400 },
        );
      }
    }

    const account = await getUserCredit(userId);
    const needCredit = Credits[modelName];
    if (
      (!account.credit && modelName !== model.freeSchnell) ||
      account.credit < needCredit
    ) {
      return NextResponse.json(
        { error: "Insufficient credit", code: 1000402 },
        { status: 400 },
      );
    }

    // 先创建 fluxData 记录
    const fluxData = await withRetry(async () => {
      return await prisma.fluxData.create({
        data: {
          userId,
          replicateId: "", // 暂时留空，等 AI Gateway 响应后更新
          inputPrompt: inputPrompt || "", // clothing-tryon 可能没有 prompt
          executePrompt: inputPrompt || "",
          model: modelName,
          aspectRatio: aspectRatio || Ratio.r1, // 默认值
          taskStatus: "Processing",
          executeStartTime: BigInt(Date.now()),
          locale,
          isPrivate: Boolean(isPrivate),
          loraName,
          ...(inputImageUrl && { inputImageUrl }),
        },
      });
    });

    try {
      let taskId: string;

      if (modelName === model.clothingTryon) {
        // 使用 RunningHub 调用 clothing-tryon 工作流
        console.log("🚀 开始调用 RunningHub clothing-tryon 工作流...");
        
        if (!userPhotoUrl) {
          throw new Error("userPhotoUrl is required for clothing-tryon model");
        }

        const res = await aiGateway.generateImageViaRunningHub({
          userPhotoUrl,
          topClothesUrl,
          bottomClothesUrl,
          is_private: Number(isPrivate) || 0,
          user_id: userId,
          locale,
        });

        if (!res?.runninghub_task_id && res.error) {
          await withRetry(async () => {
            return await prisma.fluxData.delete({
              where: { id: fluxData.id },
            });
          });
          return NextResponse.json(
            { error: res.error || "Create RunningHub Task Error" },
            { status: 400 },
          );
        }

        taskId = res.runninghub_task_id;
        
        // 更新 fluxData 记录，使用 replicateId 字段存储 runninghub_task_id
        await withRetry(async () => {
          return await prisma.fluxData.update({
            where: { id: fluxData.id },
            data: {
              replicateId: taskId, // 复用字段存储 runninghub_task_id
            },
          });
        });

        console.log('✅ RunningHub 任务创建成功，task_id:', taskId);
      } else {
        // 使用 Cloudflare AI Gateway 调用 Replicate
        console.log("🚀 开始调用 Cloudflare AI Gateway + Replicate 生成图片...");
        
        const res = await aiGateway.generateImageViaReplicate({
          model: modelName,
          input_image_url: inputImageUrl,
          input_prompt: inputPrompt!,
          aspect_ratio: aspectRatio!,
          is_private: Number(isPrivate) || 0,
          user_id: userId,
          lora_name: loraName,
          locale,
        });

        if (!res?.replicate_id && res.error) {
          await withRetry(async () => {
            return await prisma.fluxData.delete({
              where: { id: fluxData.id },
            });
          });
          return NextResponse.json(
            { error: res.error || "Create Generator Error" },
            { status: 400 },
          );
        }

        taskId = res.replicate_id;

        // 更新 fluxData 记录，添加 replicate_id
        await withRetry(async () => {
          return await prisma.fluxData.update({
            where: { id: fluxData.id },
            data: {
              replicateId: taskId,
            },
          });
        });

        console.log('✅ AI Gateway 调用成功，replicate_id:', taskId);
      }

      // 检查是否为开发模式，如果是则跳过积分扣除
      const enableDevUser = env.ENABLE_DEV_USER === "true" || env.ENABLE_DEV_USER === "1";
      const isDevelopment = process.env.NODE_ENV === "development";
      const devUserId = "dev-user-local";
      const isDevUser = enableDevUser && isDevelopment && userId === devUserId;
      
      // 如果不是开发用户，执行积分扣除和账单记录
      if (!isDevUser) {
        // 检查 account.id 是否是有效的数字
        if (!account.id || typeof account.id === "string" || isNaN(Number(account.id))) {
          console.error("❌ 无效的 account.id:", account.id);
          return NextResponse.json(
            { error: "Invalid account ID" },
            { status: 500 }
          );
        }
        
        try {
          await prisma.$transaction(async (tx) => {
            const newAccount = await tx.userCredit.update({
              where: { id: Number(account.id) },
              data: {
                credit: {
                  decrement: needCredit,
                },
              },
            });
            const billing = await tx.userBilling.create({
              data: {
                userId,
                fluxId: fluxData.id,
                state: "Done",
                amount: -needCredit,
                type: BillingType.Withdraw,
                description: `Generate ${modelName} - ${aspectRatio} Withdraw`,
              },
            });

            await tx.userCreditTransaction.create({
              data: {
                userId,
                credit: -needCredit,
                balance: newAccount.credit,
                billingId: billing.id,
                type: "Generate",
              },
            });
          }, {
            // 添加事务配置
            maxWait: 5000, // 最大等待时间
            timeout: 10000, // 事务超时时间
            isolationLevel: 'ReadCommitted', // 隔离级别
          });
        } catch (transactionError) {
          console.error('事务执行失败:', transactionError);
          
          // 如果事务失败，删除已创建的 fluxData 记录
          await withRetry(async () => {
            return await prisma.fluxData.delete({
              where: { id: fluxData.id },
            });
          });
          
          return NextResponse.json(
            { error: "Transaction failed, please try again" },
            { status: 500 },
          );
        }
      } else {
        console.log("🔧 开发模式：跳过积分扣除，使用真实 AI 生成");
      }

      return NextResponse.json({ id: FluxHashids.encode(fluxData.id) });
    } catch (aiError) {
      // 如果 AI Gateway 调用过程中出错，清理已创建的记录
      console.error("AI Gateway 调用失败:", aiError);
      await withRetry(async () => {
        return await prisma.fluxData.delete({
          where: { id: fluxData.id },
        });
      });
      throw aiError;
    }
  } catch (error) {
    console.log("error-->", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
