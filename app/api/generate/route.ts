import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import dayjs from "dayjs";
import { z } from "zod";

import { Credits, model, Ratio } from "@/config/constants";
import { FluxHashids } from "@/db/dto/flux.dto";
import { prisma } from "@/db/prisma";
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
  ]),
  inputPrompt: z.string(),
  aspectRatio: z.enum([
    Ratio.r1,
    Ratio.r2,
    Ratio.r3,
    Ratio.r4,
    Ratio.r5,
    Ratio.r6,
    Ratio.r7,
  ]),
  isPrivate: z.number().default(0),
  locale: z.string().default("en"),
  loraName: z.string().optional(),
  inputImageUrl: z.string().url().optional(),
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
    } = CreateGenerateSchema.parse(data);

    if (modelName === model.freeSchnell) {
      const thisMonthStart = dayjs().startOf("M");
      const thisMonthEnd = dayjs().endOf("M");
      const freeSchnellCount = await prisma.fluxData.count({
        where: {
          model: model.freeSchnell,
          userId,
          createdAt: {
            gte: thisMonthStart.toDate(),
            lte: thisMonthEnd.toDate(),
          },
        },
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
    const fluxData = await prisma.fluxData.create({
      data: {
        userId,
        replicateId: "", // 暂时留空，等 AI Gateway 响应后更新
        inputPrompt,
        executePrompt: inputPrompt,
        model: modelName,
        aspectRatio,
        taskStatus: "Processing",
        executeStartTime: BigInt(Date.now()),
        locale,
        isPrivate: Boolean(isPrivate),
        loraName,
        ...(inputImageUrl && { inputImageUrl }),
      },
    });

    try {
      console.log("🚀 开始调用 Cloudflare AI Gateway + Replicate 生成图片...");
      
      // 使用 Cloudflare AI Gateway 调用 Replicate
      const res = await aiGateway.generateImageViaReplicate({
        model: modelName,
        input_image_url: inputImageUrl,
        input_prompt: inputPrompt,
        aspect_ratio: aspectRatio,
        is_private: Number(isPrivate) || 0,
        user_id: userId,
        lora_name: loraName,
        locale,
      });

      if (!res?.replicate_id && res.error) {
        // 如果 AI Gateway 调用失败，删除已创建的记录
        await prisma.fluxData.delete({
          where: { id: fluxData.id },
        });
        return NextResponse.json(
          { error: res.error || "Create Generator Error" },
          { status: 400 },
        );
      }

      // 更新 fluxData 记录，添加 replicate_id
      await prisma.fluxData.update({
        where: { id: fluxData.id },
        data: {
          replicateId: res.replicate_id,
        },
      });

      console.log('✅ AI Gateway 调用成功，replicate_id:', res?.replicate_id);

      // 检查是否为开发模式，如果是则跳过积分扣除
      const isDevMode = env.GOOGLE_CLIENT_ID === "google-client-id-placeholder" || 
                        env.GOOGLE_CLIENT_SECRET === "google-client-secret-placeholder";
      
      if (!isDevMode || userId !== "dev-user-123") {
        // 执行积分扣除和账单记录（非开发模式用户）
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
        });
      } else {
        console.log("🔧 开发模式：跳过积分扣除，使用真实 AI 生成");
      }

      return NextResponse.json({ id: FluxHashids.encode(fluxData.id) });
    } catch (aiError) {
      // 如果 AI Gateway 调用过程中出错，清理已创建的记录
      console.error("AI Gateway 调用失败:", aiError);
      await prisma.fluxData.delete({
        where: { id: fluxData.id },
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
