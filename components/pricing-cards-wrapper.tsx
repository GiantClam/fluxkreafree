"use client";

import { Suspense } from "react";
import { PricingCards } from "@/components/pricing-cards";
import type { ChargeProductSelectDto } from "@/db/type";

interface PricingCardsWrapperProps {
  chargeProduct?: ChargeProductSelectDto[];
  userId?: string;
  locale?: string;
}

function PricingCardsContent({ chargeProduct, userId, locale }: PricingCardsWrapperProps) {
  return <PricingCards chargeProduct={chargeProduct} userId={userId} locale={locale} />;
}

export function PricingCardsWrapper({ chargeProduct, userId, locale }: PricingCardsWrapperProps) {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-40">Loading...</div>}>
      <PricingCardsContent chargeProduct={chargeProduct} userId={userId} locale={locale} />
    </Suspense>
  );
} 