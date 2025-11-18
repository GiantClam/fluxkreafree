import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';
import { z } from "zod";

import { model } from "@/config/constants";
import { FluxHashids } from "@/db/dto/flux.dto";
import { prisma, withRetry } from "@/lib/db-connection";
import { FluxTaskStatus } from "@/db/type";
import { getErrorMessage } from "@/lib/handle-error";

const searchParamsSchema = z.object({
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(10),
  sort: z.string().optional(),
  model: z.enum([model.dev, model.pro, model.schnell, model.kreaDev, model.clothingTryon]).optional(),
});

export async function GET(req: NextRequest) {
  // 在构建时跳过数据库查询
  if (shouldSkipDatabaseQuery()) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;
  try {
    const url = new URL(req.url);
    const values = searchParamsSchema.parse(
      Object.fromEntries(url.searchParams),
    );
    const { page, pageSize, model } = values;
    const offset = (page - 1) * pageSize;
    const whereConditions: any = {
      userId,
      taskStatus: {
        in: [FluxTaskStatus.Succeeded, FluxTaskStatus.Processing],
      },
    };
    if (model) {
      whereConditions.model = model;
    }

    const [fluxData, total] = await Promise.all([
      withRetry(async () => {
        return await prisma.fluxData.findMany({
          where: whereConditions,
          take: pageSize,
          skip: offset,
          orderBy: { createdAt: "desc" },
          // 显式选择字段，确保 aspectRatio 有默认值
          select: {
            id: true,
            userId: true,
            replicateId: true,
            inputPrompt: true,
            executePrompt: true,
            steps: true,
            guidance: true,
            interval: true,
            inputImageUrl: true,
            imageUrl: true,
            model: true,
            executeStartTime: true,
            executeEndTime: true,
            locale: true,
            aspectRatio: true,
            safetyTolerance: true,
            seed: true,
            taskStatus: true,
            isPrivate: true,
            downloadNum: true,
            viewsNum: true,
            createdAt: true,
            updatedAt: true,
            errorMsg: true,
            loraUrl: true,
            loraName: true,
            loraScale: true,
          },
        });
      }),
      withRetry(async () => {
        return await prisma.fluxData.count({ where: whereConditions });
      }),
    ]);

    return NextResponse.json({
      data: {
        total,
        page,
        pageSize,
        data: fluxData.map((item) => {
          const { id, executeEndTime, executeStartTime, loraUrl, aspectRatio } = item;
          return {
            ...item,
            aspectRatio: aspectRatio || "1:1", // 确保 aspectRatio 不为 null
            executeTime:
              executeEndTime && executeStartTime
                ? Number(`${executeEndTime - executeStartTime}`)
                : 0,
            id: FluxHashids.encode(id),
            loraUrl, // 确保 loraUrl 被包含
          };
        }),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
