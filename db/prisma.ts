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
    prisma = new PrismaClient();
  } else {
    if (!global.cachedPrisma) {
      global.cachedPrisma = new PrismaClient();
    }
    prisma = global.cachedPrisma;
  }
  console.log("✅ 运行时：创建真实Prisma客户端");
}
