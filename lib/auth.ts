import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/db/prisma";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 条件性配置
const providers: any[] = [];

// 只在Google OAuth配置存在时添加Google Provider
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  // 只在数据库URL存在且不在构建时且prisma客户端可用时使用Prisma适配器
  ...(env.DATABASE_URL && !shouldSkipDatabaseQuery() && prisma && typeof prisma === 'object' && Object.keys(prisma).length > 0 && {
    adapter: PrismaAdapter(prisma) as any,
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
  ...(env.NEXTAUTH_SECRET && { secret: env.NEXTAUTH_SECRET }),
}; 