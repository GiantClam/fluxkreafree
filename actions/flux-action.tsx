import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { model } from "@/config/constants";
import { FluxHashids } from "@/db/dto/flux.dto";
import { withRetry } from "@/lib/db-connection";
import { FluxTaskStatus } from "@/db/type";
import { getErrorMessage } from "@/lib/handle-error";
import { Prisma } from "@prisma/client";

export const searchParamsSchema = z.object({
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(12),
  sort: z.string().optional(),
  model: z.enum([model.dev, model.pro, model.schnell, model.kreaDev, model.clothingTryon]).optional(),
});

export async function getFluxById(fluxId: string) {
  try {
    const { prisma } = await import("@/lib/db-connection");
    const [id] = FluxHashids.decode(fluxId)
    const fluxData = await withRetry(async () => {
      return await prisma.fluxData.findUnique({
        where: { id: id as number },
      });
    });
    if (!fluxData) {
      return null;
    }
    return { ...fluxData, id: fluxId };
  } catch (error) {
    console.error("❌ getFluxById 数据库查询错误:", error);
    return null;
  }
}

export async function getFluxDataByPage(params: {
  page: number;
  pageSize: number;
  model?: string;
}) {

  try {
    const { prisma } = await import("@/lib/db-connection");
    const { page, pageSize, model } = params;
    const offset = (page - 1) * pageSize;
    const whereConditions: Prisma.FluxDataWhereInput = {
      isPrivate: false,
      taskStatus: {
        in: [FluxTaskStatus.Succeeded],
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
        });
      }),
      withRetry(async () => {
        return await prisma.fluxData.count({ where: whereConditions });
      }),
    ]);

    return {
      data: {
        total,
        page,
        pageSize,
        data: fluxData.map(
          ({ id, executeEndTime, executeStartTime, loraUrl, ...rest }) => ({
            ...rest,
            executeTime:
              executeEndTime && executeStartTime
                ? Number(`${executeEndTime - executeStartTime}`)
                : 0,
            id: FluxHashids.encode(id),
          }),
        ),
      },
    };
  } catch (error) {
    return {
      data: {
        total: 0,
        page: 0,
        pageSize: 0,
        data: [],
      },
      error: getErrorMessage(error),
    };
  }
}
