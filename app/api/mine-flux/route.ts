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
    const searchParams = Object.fromEntries(url.searchParams);
    
    // 记录请求参数以便调试
    console.log("📋 /api/mine-flux 请求参数:", {
      userId,
      searchParams,
      url: req.url,
    });
    
    // 解析和验证参数
    let values;
    try {
      values = searchParamsSchema.parse(searchParams);
    } catch (parseError: any) {
      console.error("❌ /api/mine-flux 参数验证失败:", {
        error: parseError,
        searchParams,
        issues: parseError?.issues,
      });
      return NextResponse.json(
        { 
          error: "Invalid request parameters", 
          details: parseError?.issues || parseError?.message 
        },
        { status: 400 },
      );
    }
    
    const { page, pageSize, model } = values;
    const offset = (page - 1) * pageSize;
    const whereConditions: any = {
      userId,
      // 移除状态过滤，显示所有状态的任务
    };
    if (model) {
      whereConditions.model = model;
    }

    // 记录查询条件
    console.log("🔍 /api/mine-flux 查询条件:", {
      userId,
      whereConditions,
      page,
      pageSize,
      offset,
    });

    const [fluxData, total] = await Promise.all([
      withRetry(async () => {
        try {
          const result = await prisma.fluxData.findMany({
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
          console.log(`✅ /api/mine-flux 查询成功，返回 ${result.length} 条记录`);
          return result;
        } catch (dbError: any) {
          console.error("❌ /api/mine-flux 数据库查询失败:", {
            error: dbError,
            message: dbError?.message,
            code: dbError?.code,
            whereConditions,
          });
          throw dbError;
        }
      }),
      withRetry(async () => {
        try {
          const count = await prisma.fluxData.count({ where: whereConditions });
          console.log(`✅ /api/mine-flux 计数查询成功，总数: ${count}`);
          return count;
        } catch (dbError: any) {
          console.error("❌ /api/mine-flux 计数查询失败:", {
            error: dbError,
            message: dbError?.message,
            code: dbError?.code,
          });
          throw dbError;
        }
      }),
    ]);

    // 处理数据映射
    const mappedData = fluxData
      .filter((item) => {
        // 过滤掉无效的记录（id 必须存在且为数字）
        if (!item.id || typeof item.id !== 'number' || isNaN(item.id)) {
          console.warn("⚠️ /api/mine-flux 跳过无效记录:", { itemId: item.id });
          return false;
        }
        return true;
      })
      .map((item) => {
        try {
          const { id, executeEndTime, executeStartTime, loraUrl, aspectRatio } = item;
          
          // 验证 id 是否有效
          if (!id || typeof id !== 'number' || isNaN(id)) {
            throw new Error(`Invalid id: ${id}`);
          }
          
          // 编码 id
          let encodedId: string;
          try {
            encodedId = FluxHashids.encode(id);
          } catch (encodeError: any) {
            console.error("❌ /api/mine-flux ID 编码失败:", {
              id,
              error: encodeError,
            });
            throw new Error(`Failed to encode id: ${id}`);
          }
          
          // 将 BigInt 字段转换为字符串，避免序列化错误
          const result: any = {
            ...item,
            aspectRatio: aspectRatio || "1:1", // 确保 aspectRatio 不为 null
            executeTime:
              executeEndTime && executeStartTime
                ? Number(`${executeEndTime - executeStartTime}`)
                : 0,
            id: encodedId,
            loraUrl: loraUrl || null, // 确保 loraUrl 被包含
          };
          
          // 将 BigInt 字段转换为字符串
          if (executeStartTime !== null && executeStartTime !== undefined) {
            result.executeStartTime = executeStartTime.toString();
          }
          if (executeEndTime !== null && executeEndTime !== undefined) {
            result.executeEndTime = executeEndTime.toString();
          }
          
          return result;
        } catch (mapError: any) {
          console.error("❌ /api/mine-flux 数据映射失败:", {
            itemId: item.id,
            error: mapError,
            message: mapError?.message,
          });
          // 如果映射失败，返回 null，后续会被过滤掉
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    console.log(`✅ /api/mine-flux 成功返回 ${mappedData.length} 条数据`);

    return NextResponse.json({
      data: {
        total,
        page,
        pageSize,
        data: mappedData,
      },
    });
  } catch (error: any) {
    console.error("❌ /api/mine-flux 错误:", {
      error,
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      userId,
    });
    
    const errorMessage = getErrorMessage(error);
    
    // 如果是数据库连接错误，返回 503
    if (errorMessage.includes('prepared statement') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('42P05') ||
        errorMessage.includes('08P01')) {
      return NextResponse.json(
        { error: "Database service temporarily unavailable. Please try again." },
        { status: 503 },
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 },
    );
  }
}
