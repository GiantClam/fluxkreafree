import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

// ⚠️ 注意：此文件主要用于 Cloudflare Workers 的 D1 适配器
// 在 Vercel/Next.js 环境中，应该使用 @/lib/db-connection 中的单例 Prisma Client
// 只有在 Cloudflare Workers 环境中才使用此文件

declare global {
  var __db__: PrismaClient;
}

// 使用 Cloudflare Workers 的 D1Database 类型
type D1Database = any;

let db: PrismaClient;

// 检查是否在 Cloudflare Workers 环境中
const isCloudflareWorkers = typeof globalThis !== 'undefined' && 
                            (globalThis as any).caches !== undefined;

if (isCloudflareWorkers) {
  // 在 Cloudflare Workers 环境中，使用 D1 适配器
  // 注意：这需要在实际使用时通过 createD1Client 函数传入 D1 数据库实例
  db = new PrismaClient();
} else {
  // 在 Vercel/Next.js 环境中，使用统一的 Prisma Client 单例
  // 这样可以避免创建多个实例导致 prepared statement 冲突
  const { prisma } = require('@/lib/db-connection');
  db = prisma;
}

export { db };

// D1 适配器函数，用于在 Cloudflare Workers 中初始化 Prisma
export function createD1Client(d1: D1Database) {
  const adapter = new PrismaD1(d1);
  return new PrismaClient({ adapter } as any);
} 