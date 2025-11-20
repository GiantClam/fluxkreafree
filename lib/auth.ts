import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { prismaWithRetry } from "@/lib/db-connection";
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