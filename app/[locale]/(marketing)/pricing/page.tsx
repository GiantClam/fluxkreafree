import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import PricingRedirect from "@/components/pricing-redirect";

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: Props) {
  const t = await getTranslations({ locale });
  return {
    title: `${t("PricingPage.title")} - ${t("LocaleLayout.title")}`,
    description: t("LocaleLayout.description"),
  };
}

export default async function PricingPage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  
  return <PricingRedirect />;
}
