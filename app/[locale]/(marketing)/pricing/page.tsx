import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import { PricingCardsWrapper } from "@/components/pricing-cards-wrapper";
import { withRetry } from "@/lib/db-connection";
import { ChargeProductHashids } from "@/db/dto/charge-product.dto";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";
import type { ChargeProductSelectDto } from "@/db/type";

interface Props {
  params: { locale: string };
}

// 强制动态渲染，避免静态生成时的数据库连接冲突
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params: { locale } }: Props) {
  const t = await getTranslations({ locale });
  return {
    title: `${t("PricingPage.title")} - ${t("LocaleLayout.title")}`,
    description: t("LocaleLayout.description"),
  };
}

export default async function PricingPage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  
  // 在构建时或没有数据库连接时返回默认值
  let chargeProducts: any[] = [];
  if (!shouldSkipDatabaseQuery()) {
    try {
      const { prisma } = await import("@/lib/db-connection");
      chargeProducts = await withRetry(async () => {
        return await prisma.chargeProduct.findMany({
          where: {
            state: "active",
          },
          orderBy: {
            amount: 'asc',
          },
        });
      });
    } catch (error) {
      console.error("❌ PricingPage 数据库查询错误:", error);
      // 如果数据库查询失败，使用默认数据
      chargeProducts = [];
    }
  }
  
  // 转换为 DTO 格式
  const chargeProduct: ChargeProductSelectDto[] = chargeProducts.map(product => ({
    ...product,
    id: ChargeProductHashids.encode(product.id),
  }));
  
  return (
    <div className="container mx-auto px-4 py-8">
      <PricingCardsWrapper 
        chargeProduct={chargeProduct} 
        locale={locale}
      />
    </div>
  );
}
