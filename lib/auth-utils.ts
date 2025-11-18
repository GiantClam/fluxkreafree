import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";
import { withRetry } from "@/lib/db-connection";

export async function getUser() {
  const session = await getServerSession(authOptions);
  return session?.user || null;
}

export async function getCurrentUser() {
  // 在构建时或没有数据库连接时返回null
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过用户认证，返回null");
    return null;
  }

  try {
    // 开发模式：如果启用了 ENABLE_DEV_USER，直接返回默认开发用户
    const enableDevUser = env.ENABLE_DEV_USER === "true" || env.ENABLE_DEV_USER === "1";
    const isDevelopment = process.env.NODE_ENV === "development";
    
    if (enableDevUser && isDevelopment) {
      console.log("🔧 开发模式：使用默认开发用户（无需 Google Auth）");
      
      const devUserId = "dev-user-local";
      const devUserEmail = "dev@localhost.local";
      
      try {
        const { prisma } = await import("@/lib/db-connection");
        // 确保开发用户在数据库中存在
        let user = await withRetry(async () => {
          return await prisma.user.findUnique({
            where: { id: devUserId },
          });
        });
        
        if (!user) {
          // 创建开发用户
          user = await withRetry(async () => {
            return await prisma.user.create({
              data: {
                id: devUserId,
                email: devUserEmail,
                name: "本地开发用户",
                emailVerified: new Date(),
                isAdmin: false,
              },
            });
          });
          console.log("✅ 已创建本地开发用户");
          
          // 为开发用户创建积分记录，给予充足的积分（100000）
          try {
            await withRetry(async () => {
              const existingCredit = await prisma.userCredit.findFirst({
                where: { userId: devUserId },
              });
              
              if (existingCredit) {
                return await prisma.userCredit.update({
                  where: { id: existingCredit.id },
                  data: { credit: 100000 },
                });
              } else {
                return await prisma.userCredit.create({
                  data: {
                    userId: devUserId,
                    credit: 100000, // 开发环境给予充足积分
                  },
                });
              }
            });
            console.log("✅ 已为开发用户设置充足积分（100000）");
          } catch (creditError) {
            console.error("❌ 设置开发用户积分失败:", creditError);
          }
        } else {
          // 如果用户已存在，确保积分充足（每次检查时更新为 100000）
          try {
            const userCredit = await withRetry(async () => {
              return await prisma.userCredit.findFirst({
                where: { userId: devUserId },
              });
            });
            
            if (!userCredit || userCredit.credit < 10000) {
              // 如果积分不足 10000，更新为 100000
              await withRetry(async () => {
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
              console.log("✅ 已为开发用户补充积分至 100000");
            }
          } catch (creditError) {
            console.error("❌ 检查/更新开发用户积分失败:", creditError);
          }
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      } catch (error) {
        console.error("❌ 创建开发用户失败:", error);
        // 如果数据库操作失败，仍然返回开发用户对象
        return {
          id: devUserId,
          email: devUserEmail,
          name: "本地开发用户",
          image: null,
        };
      }
    }
    
    // 生产模式：使用正常的 Google Auth 认证
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    
    const userId = session.user.id!;
    
    // 检查 User 记录是否在数据库中存在
    // 如果不存在，说明用户还没有完成完整的登录流程，应该让用户重新登录
    try {
      const { prisma } = await import("@/lib/db-connection");
      const user = await withRetry(async () => {
        return await prisma.user.findUnique({
          where: { id: userId },
        });
      });
      
      // 如果 User 不存在，返回 null，让用户重新登录
      // 这样可以确保用户完成完整的 NextAuth 登录流程，创建 User 记录
      if (!user) {
        console.log(`⚠️ User ${userId} 在数据库中不存在，需要用户重新登录`);
        return null;
      }
    } catch (error) {
      console.error("❌ 检查 User 记录时出错:", error);
      // 如果检查失败，返回 null，让用户重新登录
      return null;
    }
    
    return {
      id: userId,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    };
  } catch (error) {
    console.error("❌ getCurrentUser 错误:", error);
    return null;
  }
}

export async function auth() {
  try {
    // 开发模式：如果启用了 ENABLE_DEV_USER，直接返回默认开发用户
    const enableDevUser = env.ENABLE_DEV_USER === "true" || env.ENABLE_DEV_USER === "1";
    const isDevelopment = process.env.NODE_ENV === "development";
    
    if (enableDevUser && isDevelopment) {
      const devUserId = "dev-user-local";
      const devUserEmail = "dev@localhost.local";
      
      return {
        userId: devUserId,
        user: {
          id: devUserId,
          email: devUserEmail,
          name: "本地开发用户",
          image: null,
        },
        protect: () => {
          // 开发模式下不抛出错误
        }
      };
    }
    
    const session = await getServerSession(authOptions);
    return {
      userId: session?.user?.id || null,
      user: session?.user || null,
      protect: () => {
        if (!session?.user) {
          throw new Error("Unauthorized");
        }
      }
    };
  } catch (error) {
    console.error("❌ auth 错误:", error);
    return {
      userId: null,
      user: null,
      protect: () => {
        throw new Error("Unauthorized");
      }
    };
  }
}

export function getAuthFromRequest(req: NextRequest) {
  // This would need to be implemented based on your session strategy
  // For now, we'll return a placeholder
  return {
    userId: null,
    redirectToSignIn: () => {
      return Response.redirect(new URL("/auth/signin", req.url));
    },
    protect: () => {
      if (!req.headers.get("authorization")) {
        throw new Error("Unauthorized");
      }
    }
  };
} 