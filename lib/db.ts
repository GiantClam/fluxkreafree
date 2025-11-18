/**
 * 数据库客户端导出
 * 项目只部署在 Vercel，直接使用统一的 Prisma Client 单例
 */

import { prisma } from '@/lib/db-connection';

export { prisma as db }; 