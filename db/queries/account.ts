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

  // 开发模式：为开发用户提供充足积分
  const enableDevUser = env.ENABLE_DEV_USER === "true" || env.ENABLE_DEV_USER === "1";
  const isDevelopment = process.env.NODE_ENV === "development";
  const devUserId = "dev-user-local";
  
  if (enableDevUser && isDevelopment && userId === devUserId) {
    console.log("🔧 开发模式：为开发用户提供充足积分（100000）");
    // 确保数据库中有充足的积分
    try {
      const { prisma } = await import("@/lib/db-connection");
      const userCredit = await withRetry(async () => {
        return await prisma.userCredit.findFirst({
          where: { userId: devUserId },
        });
      });
      
      if (!userCredit || userCredit.credit < 10000) {
        // 如果积分不足 10000，更新为 100000
        const updatedCredit = await withRetry(async () => {
          if (userCredit) {
            return await prisma.userCredit.update({
              where: { id: userCredit.id },
              data: { credit: 100000 },
            });
          } else {
            return await prisma.userCredit.create({
              data: {
                userId: devUserId,
                credit: 100000,
              },
            });
          }
        });
        return updatedCredit;
      }
      
      return userCredit;
    } catch (error) {
      console.error("❌ 获取开发用户积分失败:", error);
      // 返回默认值
      return {
        id: "dev-credit-local",
        userId: devUserId,
        credit: 100000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
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
      // 如果 userCredit 不存在，先确保 User 记录存在
      // 然后创建 userCredit 记录
      accountInfo = await withRetry(async () => {
        // 先检查 User 是否存在
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });
        
        // 如果 User 不存在，抛出错误，让调用方处理（通常是让用户重新登录）
        if (!user) {
          const error = new Error(`User ${userId} does not exist in database. Please sign in again.`);
          (error as any).code = 'USER_NOT_FOUND';
          throw error;
        }
        
        // 现在可以安全地创建 userCredit 记录
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
