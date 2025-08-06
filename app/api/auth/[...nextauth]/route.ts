import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 