"use client";

import { useTransition } from "react";

import { useAuth } from "@/hooks/use-auth";

import { generateUserStripe } from "@/actions/generate-user-stripe";
import { Icons } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import type { ChargeProductSelectDto } from "@/db/type";
import { url } from "@/lib";
import { usePathname } from "@/lib/navigation";
import { SubscriptionPlan, UserSubscriptionPlan } from "@/types";

interface BillingFormButtonProps {
  offer: ChargeProductSelectDto;
  btnText?: string;
}

export function BillingFormButton({
  offer,
  btnText = "Buy Plan",
}: BillingFormButtonProps) {
  let [isPending, startTransition] = useTransition();
  const { userId } = useAuth();
  const pathname = usePathname();

  const stripeSessionAction = () =>
    startTransition(async () => {
      const data = await fetch(`/api/charge-order`, {
        method: "POST",
        body: JSON.stringify({
          amount: offer.amount,
          channel: "Stripe",
          productId: offer.id,
          url: url(pathname).href,
          currency: offer.currency?.toUpperCase(),
        }),
        credentials: 'include',
      }).then((res) => res.json());
      window.location.href = data.url;
    });
  const userOffer = offer.amount === 1990;
  return (
    <Button
      variant={userOffer ? "default" : "outline"}
      className="w-full"
      disabled={isPending}
      onClick={stripeSessionAction}
    >
      {isPending ? (
        <>
          <Icons.spinner className="mr-2 size-4 animate-spin" /> Loading...
        </>
      ) : (
        <>{btnText}</>
      )}
    </Button>
  );
}
