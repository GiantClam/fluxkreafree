import { PrismaClient } from "@prisma/client";

import "server-only";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

declare global {
  // eslint-disable-next-line no-var
  var cachedPrisma: PrismaClient;
}

export let prisma: PrismaClient;

// 检查是否在构建时
const isBuildTime = shouldSkipDatabaseQuery();

if (isBuildTime) {
  // 在构建时创建一个虚拟的Prisma客户端，避免构建时数据库连接
  prisma = {} as any;
  console.log("🔧 构建时：跳过Prisma客户端初始化");
} else {
  // 在运行时创建真实的Prisma客户端
  if (process.env.NODE_ENV === "production") {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // 添加连接池配置
      log: ['error', 'warn'],
    });
  } else {
    if (!global.cachedPrisma) {
      global.cachedPrisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
        // 添加连接池配置
        log: ['error', 'warn'],
      });
    }
    prisma = global.cachedPrisma;
  }
  console.log("✅ 运行时：创建真实Prisma客户端");
}

// 优雅关闭连接
process.on('beforeExit', async () => {
  if (!isBuildTime) {
    await prisma.$disconnect();
  }
});
