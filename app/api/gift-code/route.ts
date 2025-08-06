import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import { z } from "zod";

import { ChargeOrderHashids } from "@/db/dto/charge-order.dto";
import { prisma } from "@/db/prisma";
import { getUserCredit } from "@/db/queries/account";

import { Currency, OrderPhase } from "@/db/type";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";

const CreateGiftCodeOrderSchema = z.object({
  code: z.string().min(8),
});

const ratelimit = new KVRateLimit(kv, {
  limit: 2,
  window: "5s"
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;

  const { success } = await ratelimit.limit(
    "gift-code:redeemed" + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const data = await req.json();
    const { code } = CreateGiftCodeOrderSchema.parse(data);
    const giftCodeData = await prisma.giftCode.findFirst({
      where: {
        code,
      },
    });

    if (!giftCodeData || !giftCodeData?.id) {
      return new Response("gift code doesn't exist", {
        status: 400,
      });
    }
    if (giftCodeData?.expiredAt && giftCodeData?.expiredAt < new Date()) {
      return new Response("gift code has expired", {
        status: 400,
      });
    }
    if (giftCodeData.used) {
      return new Response("gift code has been used", {
        status: 400,
      });
    }
    const account = await getUserCredit(userId);

    await prisma.$transaction(async (tx) => {
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
          credit: giftCodeData.creditAmount,
          channel: "GiftCode",
          phase: OrderPhase.Paid,
        },
      });

      const newUserCredit = await tx.userCredit.update({
        where: {
          id: Number(account.id),
        },
        data: {
          credit: {
            increment: giftCodeData.creditAmount,
          },
        },
      });
      const transaction = await tx.userCreditTransaction.create({
        data: {
          userId: userId,
          credit: giftCodeData.creditAmount,
          balance: newUserCredit.credit,
          type: "Charge",
        },
      });

      await tx.giftCode.update({
        where: {
          id: giftCodeData.id,
        },
        data: {
          used: true,
          usedBy: userId,
          usedAt: new Date(),
          transactionId: transaction.id,
        },
      });
    });

    return NextResponse.json({
      message: "ok",
      creditAmount: giftCodeData.creditAmount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
