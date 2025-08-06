import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";

import { getErrorMessage } from "@/lib/handle-error";
import { prisma } from "@/db/prisma";
import { stripe } from "@/lib/stripe";
import { env } from "@/env.mjs";
import { OrderPhase, PaymentChannelType } from "@/db/type";
import { ChargeOrderHashids } from "@/db/dto/charge-order.dto";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("❌ Missing Stripe signature");
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // 验证 webhook 签名
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  console.log("✅ Webhook signature verified");
  console.log("📨 Event type:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ 
      message: "Webhook processed successfully" 
    });
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log("💰 Processing checkout.session.completed");
  
  if (!session.metadata?.orderId) {
    console.error("❌ No orderId in session metadata");
    return;
  }

  const orderId = session.metadata.orderId;
  const userId = session.metadata.userId;
  const chargeProductId = session.metadata.chargeProductId;

  console.log("📋 Order details:", { orderId, userId, chargeProductId });

  try {
    // 解码订单ID
    const [decodedOrderId] = ChargeOrderHashids.decode(orderId);
    
    // 查找并更新订单状态
    const order = await prisma.chargeOrder.findFirst({
      where: {
        id: decodedOrderId as number,
        userId: userId,
        phase: OrderPhase.Pending,
      },
    });

    if (!order) {
      console.error("❌ Order not found or already processed:", orderId);
      return;
    }

    // 更新订单状态为已支付
    await prisma.$transaction(async (tx) => {
      // 更新订单状态
      await tx.chargeOrder.update({
        where: { id: order.id },
        data: {
          phase: OrderPhase.Paid,
          paymentAt: new Date(),
        },
      });

      // 增加用户积分
      const userCredit = await tx.userCredit.findFirst({
        where: { userId: userId },
      });

      if (userCredit) {
        await tx.userCredit.update({
          where: { id: userCredit.id },
          data: {
            credit: {
              increment: order.credit,
            },
          },
        });
      } else {
        await tx.userCredit.create({
          data: {
            userId: userId,
            credit: order.credit,
          },
        });
      }

      // 记录积分交易
      const updatedCredit = await tx.userCredit.findFirst({
        where: { userId: userId },
      });

      await tx.userCreditTransaction.create({
        data: {
          userId: userId,
          credit: order.credit,
          balance: updatedCredit?.credit || order.credit,
          type: "Charge",
          billingId: order.id,
        },
      });
    });

    console.log("✅ Order processed successfully:", orderId);
  } catch (error) {
    console.error("❌ Error processing order:", error);
    throw error;
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log("💳 Processing payment_intent.succeeded");
  
  if (paymentIntent.metadata?.orderId) {
    // 如果payment intent包含orderId，处理一次性付款
    await handleCheckoutSessionCompleted({
      metadata: paymentIntent.metadata,
    } as Stripe.Checkout.Session);
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log("📄 Processing invoice.payment_succeeded");
  
  if (invoice.subscription) {
    // 处理订阅付款
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    await handleSubscriptionUpdated(subscription);
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log("🆕 Processing subscription.created");
  
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("❌ No userId in subscription metadata");
    return;
  }

  try {
    await prisma.userPaymentInfo.upsert({
      where: { userId: userId },
      update: {
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
      create: {
        userId: userId,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    console.log("✅ Subscription created successfully");
  } catch (error) {
    console.error("❌ Error creating subscription:", error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("🔄 Processing subscription.updated");
  
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("❌ No userId in subscription metadata");
    return;
  }

  try {
    await prisma.userPaymentInfo.update({
      where: { userId: userId },
      data: {
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    console.log("✅ Subscription updated successfully");
  } catch (error) {
    console.error("❌ Error updating subscription:", error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("🗑️ Processing subscription.deleted");
  
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("❌ No userId in subscription metadata");
    return;
  }

  try {
    await prisma.userPaymentInfo.update({
      where: { userId: userId },
      data: {
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      },
    });

    console.log("✅ Subscription deleted successfully");
  } catch (error) {
    console.error("❌ Error deleting subscription:", error);
    throw error;
  }
} 