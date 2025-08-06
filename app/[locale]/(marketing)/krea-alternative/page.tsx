import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: Props) {
  const t = await getTranslations({ locale, namespace: "KreaAlternativePage" });
  return {
    title: `${t("title")} | FluxKreaFree`,
    description: t("description"),
    keywords: "krea ai alternative, free krea alternative, krea ai free, krea vs fluxkreafree, best krea alternative, krea ai vs midjourney, krea ai app alternative, krea enhancer alternative, krea video alternative",
  };
}

export default async function KreaAlternativePage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "KreaAlternativePage" });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          {t("title")}
        </h1>
        <p className="text-xl text-muted-foreground mb-6">
          {t("description")}
        </p>
        <div className="flex justify-center gap-4 mb-6">
          <Badge className="text-lg px-4 py-2">{t("badges.free")}</Badge>
          <Badge className="text-lg px-4 py-2">{t("badges.limits")}</Badge>
          <Badge className="text-lg px-4 py-2">{t("badges.technology")}</Badge>
        </div>
        <Button asChild className="mr-4">
          <Link href="/app/generate">{t("startButton")}</Link>
        </Button>
      </div>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("whyChoose.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              {t("whyChoose.description")}
            </p>
            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">{t("whyChoose.sameTech.title")}</h3>
                <p className="text-muted-foreground">
                  {t("whyChoose.sameTech.description")}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">{t("whyChoose.free.title")}</h3>
                <p className="text-muted-foreground">
                  {t("whyChoose.free.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center bg-gradient-to-r from-green-50 to-blue-50 p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">{t("cta.title")}</h2>
          <p className="text-lg mb-6">
            {t("cta.description")}
          </p>
          <Button asChild>
            <Link href="/app/generate">{t("cta.button")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 