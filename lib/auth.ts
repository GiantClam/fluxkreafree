import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { prismaWithRetry, withRetry } from "@/lib/db-connection";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 条件性配置
const providers: any[] = [];

// 开发模式：如果启用了 ENABLE_DEV_USER，跳过 Google Provider
const enableDevUser = env.ENABLE_DEV_USER === "true" || env.ENABLE_DEV_USER === "1";
const isDevelopment = process.env.NODE_ENV === "development";

// 只在非开发模式或未启用开发用户时，且Google OAuth配置存在时添加Google Provider
if (!(enableDevUser && isDevelopment) && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  // 只在数据库URL存在且不在构建时且prisma客户端可用时使用Prisma适配器
  ...(env.DATABASE_URL && !shouldSkipDatabaseQuery() && prismaWithRetry && typeof prismaWithRetry === 'object' && Object.keys(prismaWithRetry).length > 0 && {
    adapter: PrismaAdapter(prismaWithRetry) as any,
  }),
  providers,
  debug: process.env.NODE_ENV === "development",
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
    jwt: async ({ user, token }) => {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
    signIn: async ({ user, account, profile }) => {
      console.log("🔐 登录回调:", { 
        user: user?.email, 
        provider: account?.provider,
        hasProfile: !!profile 
      });

      // 如果用户ID不存在，跳过积分处理
      if (!user?.id) {
        return true;
      }

      const userId = user.id;

      // 跳过开发用户的积分处理（开发用户已经有充足积分）
      const enableDevUser = env.ENABLE_DEV_USER === "true" || env.ENABLE_DEV_USER === "1";
      const isDevelopment = process.env.NODE_ENV === "development";
      const devUserId = "dev-user-local";
      
      if (enableDevUser && isDevelopment && userId === devUserId) {
        return true;
      }

      // 如果数据库不可用，跳过积分处理
      if (shouldSkipDatabaseQuery() || !prismaWithRetry) {
        return true;
      }

      try {
        await withRetry(async () => {
          const { prisma } = await import("@/lib/db-connection");
          
          return await prisma.$transaction(async (tx) => {
            // 检查用户积分记录是否存在
            const userCredit = await tx.userCredit.findFirst({
              where: { userId },
            });

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            // 检查今天是否已经领取过每日奖励
            const hasReceivedDailyReward = userCredit?.lastDailyRewardAt 
              ? new Date(userCredit.lastDailyRewardAt) >= today
              : false;

            // 如果是新用户（没有积分记录），赠送注册奖励100积分 + 每日登录奖励10积分
            if (!userCredit) {
              const newCredit = await tx.userCredit.create({
                data: {
                  userId,
                  credit: 110, // 注册奖励100 + 每日登录奖励10
                  lastDailyRewardAt: now, // 记录今日已领取每日奖励
                },
              });

              // 记录注册奖励积分交易
              await tx.userCreditTransaction.create({
                data: {
                  userId,
                  credit: 100,
                  balance: 100,
                  type: "SignUpBonus",
                },
              });

              // 记录每日登录奖励积分交易
              await tx.userCreditTransaction.create({
                data: {
                  userId,
                  credit: 10,
                  balance: 110,
                  type: "DailyLogin",
                },
              });

              console.log(`✅ 新用户注册奖励：用户 ${userId} 获得 100 积分（注册）+ 10 积分（每日登录）= 110 积分`);
            } 
            // 如果是老用户且今天还没领取每日奖励，赠送10积分
            else if (!hasReceivedDailyReward) {
              const updatedCredit = await tx.userCredit.update({
                where: { id: userCredit.id },
                data: {
                  credit: { increment: 10 },
                  lastDailyRewardAt: now,
                },
              });

              // 记录积分交易
              await tx.userCreditTransaction.create({
                data: {
                  userId,
                  credit: 10,
                  balance: updatedCredit.credit,
                  type: "DailyLogin",
                },
              });

              console.log(`✅ 每日登录奖励：用户 ${userId} 获得 10 积分，当前余额：${updatedCredit.credit}`);
            } else {
              console.log(`ℹ️ 用户 ${userId} 今日已领取过每日登录奖励`);
            }
          });
        });
      } catch (error) {
        // 积分处理失败不应该阻止登录
        console.error("❌ 处理登录积分奖励失败:", error);
      }

      return true;
    },
  },
  pages: {
    signIn: "/signin",
    signOut: "/signout",
    error: "/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // 在开发环境中，如果没有设置 NEXTAUTH_SECRET，使用默认值
  // 在生产环境中，NEXTAUTH_SECRET 是必需的
  secret: env.NEXTAUTH_SECRET || (isDevelopment ? "dev-secret-key-change-in-production" : undefined),
}; 