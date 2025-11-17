// 统一使用 lib/db-connection.ts 中的 Prisma 客户端实例
// 这样可以避免创建多个 Prisma 客户端实例，从而避免 prepared statement 冲突
import "server-only";
import { prisma as dbConnectionPrisma } from "@/lib/db-connection";

// 重新导出，确保所有地方使用同一个 Prisma 客户端实例
export const prisma = dbConnectionPrisma;
