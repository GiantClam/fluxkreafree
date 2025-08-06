import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

declare global {
  var __db__: PrismaClient;
}

// 使用 Cloudflare Workers 的 D1Database 类型
type D1Database = any;

let db: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  // 在生产环境中，我们需要从 Cloudflare Workers 的绑定中获取 D1 数据库
  // 这里会在运行时被替换
  db = new PrismaClient();
} else {
  // 在开发环境中，使用本地 SQLite
  if (!global.__db__) {
    global.__db__ = new PrismaClient();
  }
  db = global.__db__;
}

export { db };

// D1 适配器函数，用于在 Cloudflare Workers 中初始化 Prisma
export function createD1Client(d1: D1Database) {
  const adapter = new PrismaD1(d1);
  return new PrismaClient({ adapter } as any);
} 