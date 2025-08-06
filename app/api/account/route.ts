import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

import { AccountHashids } from "@/db/dto/account.dto";
import { getUserCredit } from "@/db/queries/account";
import { redis } from "@/lib/redis";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 在构建时跳过数据库查询
    if (shouldSkipDatabaseQuery()) {
      console.log("🔧 构建时：跳过 /api/account 查询");
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    console.time("stat");
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    // console.timeLog("stat");

    // const ratelimit = new Ratelimit({
    //   redis,
    //   limiter: Ratelimit.slidingWindow(5, "5 s"),
    //   analytics: true,
    // });
    // const { success } = await ratelimit.limit(
    //   "account:info" + `_${req.ip ?? ""}`,
    // );
    console.timeLog("stat");

    // if (!success) {
    //   return new Response("Too Many Requests", {
    //     status: 429,
    //   });
    // }

    const accountInfo = await getUserCredit(user.id);
    console.timeEnd("stat");

    return NextResponse.json({
      ...accountInfo,
      id: AccountHashids.encode(Number(accountInfo.id)),
    });
  } catch (error) {
    console.error("❌ /api/account 错误:", error);
    
    // 在构建时或出现错误时返回503
    if (shouldSkipDatabaseQuery()) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
