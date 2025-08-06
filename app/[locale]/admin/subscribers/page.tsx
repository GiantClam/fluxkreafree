import React from "react";

import { prisma } from "@/db/prisma";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

import SubscribersCard from "./_mods/card";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

export default async function AdminSubscribersPage() {
  // 在构建时或没有数据库连接时返回默认值
  if (shouldSkipDatabaseQuery()) {
    const defaultCount = {
      today_count: 0,
      this_month_count: 0,
      total: 0
    };
    const defaultData = [];
    
    return <SubscribersCard count={defaultCount} dataSource={defaultData} />;
  }

  // Get counts using Prisma queries instead of raw SQL for SQLite compatibility
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [todayCount, thisMonthCount, total] = await Promise.all([
    prisma.subscribers.count({
      where: {
        subscribedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    }),
    prisma.subscribers.count({
      where: {
        subscribedAt: {
          gte: firstDayOfMonth,
          lt: firstDayOfNextMonth
        }
      }
    }),
    prisma.subscribers.count({
      where: {
        subscribedAt: {
          not: null
        }
      }
    })
  ]);

  const count = {
    today_count: todayCount,
    this_month_count: thisMonthCount, 
    total: total
  };

  // const {
  //   rows: [count],
  // } = await db.execute<{
  //   total: number;
  //   today_count: number;
  //   this_month_count: number;
  // }>(
  //   sql`SELECT
  // (SELECT COUNT(*) FROM subscribers WHERE subscribed_at::date = CURRENT_DATE) AS today_count,
  // (SELECT COUNT(*) FROM subscribers WHERE EXTRACT(YEAR FROM subscribed_at) = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM subscribed_at) = EXTRACT(MONTH FROM CURRENT_DATE)) AS this_month_count,
  // (SELECT COUNT(*) FROM subscribers WHERE subscribed_at IS NOT NULL) as total`,
  // );
  const subs = await prisma.subscribers.findMany({
    where: {
      subscribedAt: {
        lte: new Date(),
      },
    },
    take: 30,
    orderBy: {
      subscribedAt: "desc",
    },
  });

  return <SubscribersCard count={count ?? {}} dataSource={subs} />;
}
