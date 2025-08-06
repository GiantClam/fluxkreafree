import { prisma } from "@/db/prisma";
import { shouldSkipDatabaseQuery, getBuildTimeFallback } from "@/lib/build-check";

import NewsLatterCard from "./_mods/card";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

export default async function AdminNewslettersPage() {
  // 在构建时或没有数据库连接时返回默认值
  if (shouldSkipDatabaseQuery()) {
    const defaultCount = {
      today_count: 0,
      this_month_count: 0,
      total: 0
    };
    const defaultData = [];
    
    return <NewsLatterCard count={defaultCount} dataSource={defaultData} />;
  }

  // Get counts using Prisma queries instead of raw SQL for SQLite compatibility  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [todayCount, thisMonthCount, total] = await Promise.all([
    prisma.newsletters.count({
      where: {
        sentAt: {
          gte: today,
          lt: tomorrow
        }
      }
    }),
    prisma.newsletters.count({
      where: {
        sentAt: {
          gte: firstDayOfMonth,
          lt: firstDayOfNextMonth
        }
      }
    }),
    prisma.newsletters.count()
  ]);

  const count = {
    today_count: todayCount,
    this_month_count: thisMonthCount, 
    total: total
  };
  const nl = await prisma.newsletters.findMany({
    take: 100,
    orderBy: {
      sentAt: "desc",
    },
  });

  return <NewsLatterCard count={count ?? {}} dataSource={nl} />;
}
