import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { Prisma } from "@prisma/client";

import { z } from "zod";

import { prisma } from "@/db/prisma";
import { getUserCredit } from "@/db/queries/account";
import { Currency, OrderPhase, PaymentChannelType } from "@/db/type";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";

const ratelimit = new KVRateLimit(kv, {
  limit: 2,
  window: "5s"
});
const activityCode = "NEW_REGISTER_ACTIVITY";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;
  const targetDate = new Date("2024-08-20T20:20:00+08:00");
  const oneMonthLater = new Date(
    targetDate.getTime() + 30 * 24 * 60 * 60 * 1000,
  );
  // Step 1: Get the IDs of claimed orders for the user
  const claimedOrderIds = await prisma.claimedActivityOrder.findMany({
    where: {
      activityCode,
      userId,
    },
    select: {
      id: true,
    },
  });
  const claimedIds = claimedOrderIds.map((row) => row.id);

  const charOrders = await prisma.chargeOrder.findMany({
    where: {
      phase: OrderPhase.Paid,
      userId,
      channel: PaymentChannelType.Stripe,
      paymentAt: {
        gte: targetDate,
        lte: oneMonthLater,
      },
      id: {
        notIn: claimedIds,
      },
    },
  });

  if (!charOrders.length) {
    return NextResponse.json(
      { error: "No orders found", code: 1000401 },
      { status: 400 },
    );
  }
  return NextResponse.json({
    claimed: true,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;

  const { success } = await ratelimit.limit(
    "get-offer:redeemed" + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const activityCredit = 0.2;
    const targetDate = new Date("2024-08-20T20:20:00+08:00");
    const oneMonthLater = new Date(
      targetDate.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    // Step 1: Get the IDs of claimed orders for the user
    const claimedOrderIds = await prisma.claimedActivityOrder.findMany({
      where: {
        activityCode,
        userId,
      },
      select: {
        id: true,
        chargeOrderId: true,
      },
    });
    const claimedChargeOrderIdIds = claimedOrderIds.map((row) => row.chargeOrderId);
    const charOrders = await prisma.chargeOrder.findMany({
      where: {
        phase: OrderPhase.Paid,
        userId,
        channel: PaymentChannelType.Stripe,
        paymentAt: {
          gte: targetDate,
          lte: oneMonthLater,
        },
        id: {
          notIn: claimedChargeOrderIdIds,
        },
      },
    });
    if (!charOrders.length) {
      return NextResponse.json(
        { error: "No orders found", code: 1000401 },
        { status: 400 },
      );
    }

    const account = await getUserCredit(userId);

    await prisma.$transaction(async (tx) => {
      let totalCredit = 0;
      const claimedOrders = charOrders.map((order) => {
        const credit = order.credit * activityCredit;
        totalCredit = totalCredit + credit;

        return {
          userId,
          activityCode,
          credit: order.credit * activityCredit,
          chargeOrderId: order.id,
        };
      });
      await tx.chargeOrder.create({
        data: {
          userId,
          userInfo: JSON.stringify({
            fullName: user.name,
            email: user.email,
            username: user.email,
          }),
          currency: Currency.USD,
          amount: 0,
          credit: totalCredit,
          channel: PaymentChannelType.ActivityCredit,
          phase: OrderPhase.Paid,
        },
      });
      const newUserCredit = await tx.userCredit.update({
        where: {
          id: Number(account.id),
        },
        data: {
          credit: {
            increment: totalCredit,
          },
        },
      });
      const transaction = await tx.userCreditTransaction.create({
        data: {
          userId: userId,
          credit: totalCredit,
          balance: newUserCredit.credit,
          type: "EventCharge",
        },
      });
      await tx.claimedActivityOrder.createMany({
        data: claimedOrders.map((item) => ({
          ...item,
          transactionId: transaction.id,
        })),
      });
    });

    return NextResponse.json({
      message: "ok",
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
