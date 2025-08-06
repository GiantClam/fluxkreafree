import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";
import { prisma } from "@/db/prisma";

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
    // 开发模式：如果 Google OAuth 配置是占位符，创建一个测试用户
    const isDevMode = env.GOOGLE_CLIENT_ID === "google-client-id-placeholder" || 
                      env.GOOGLE_CLIENT_SECRET === "google-client-secret-placeholder";
    
    if (isDevMode && process.env.NODE_ENV === "development") {
      console.log("🔧 开发模式：使用测试用户账户");
      
      const testUserId = "dev-user-123";
      const testUserEmail = "dev@localhost.com";
      
      try {
        // 确保测试用户在数据库中存在
        let user = await prisma.user.findUnique({
          where: { id: testUserId },
        });
        
        if (!user) {
          // 创建测试用户
          user = await prisma.user.create({
            data: {
              id: testUserId,
              email: testUserEmail,
              name: "开发测试用户",
              emailVerified: new Date(),
              isAdmin: false,
            },
          });
          console.log("✅ 已创建开发模式测试用户");
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      } catch (error) {
        console.error("❌ 创建开发模式用户失败:", error);
        // 如果数据库操作失败，仍然返回测试用户对象
        return {
          id: testUserId,
          email: testUserEmail,
          name: "开发测试用户",
          image: null,
        };
      }
    }
    
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    
    return {
      id: session.user.id!,
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