import { withRetry } from "@/lib/db-connection";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery, getBuildTimeFallback } from "@/lib/build-check";

export async function getUserCredit(userId: string) {
  // 在构建时或没有数据库连接时返回默认值
  if (shouldSkipDatabaseQuery()) {
    return getBuildTimeFallback({
      id: "build-credit-123",
      userId: userId,
      credit: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 开发模式：为测试用户提供无限信用
  const isDevMode = env.GOOGLE_CLIENT_ID === "google-client-id-placeholder" || 
                    env.GOOGLE_CLIENT_SECRET === "google-client-secret-placeholder";
  
  if (isDevMode && process.env.NODE_ENV === "development" && userId === "dev-user-123") {
    console.log("🔧 开发模式：为测试用户提供 1000 信用额度");
    return {
      id: "dev-credit-123",
      userId: "dev-user-123",
      credit: 1000, // 开发模式提供充足的信用额度
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  
  try {
    // 使用新的重试机制查询用户积分
    const { prisma } = await import("@/lib/db-connection");
    
    let accountInfo = await withRetry(async () => {
      return await prisma.userCredit.findFirst({
        where: {
          userId,
        },
      });
    });

    if (!accountInfo?.id) {
      // 如果用户不存在，创建新用户记录
      accountInfo = await withRetry(async () => {
        return await prisma.userCredit.create({
          data: {
            userId: userId,
            credit: 0,
          },
        });
      });
    }
    
    return accountInfo;
  } catch (error) {
    console.error('获取用户积分失败:', error);
    
    // 如果数据库查询失败，返回默认值
    return {
      id: "fallback-credit-123",
      userId: userId,
      credit: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
