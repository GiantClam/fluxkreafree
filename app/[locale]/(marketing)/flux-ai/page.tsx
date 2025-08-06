import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: Props) {
  const t = await getTranslations({ locale, namespace: "FluxAIPage" });
  return {
    title: `${t("title")} | FluxKreaFree`,
    description: t("description"),
    keywords: "flux.1, what is flux.1, krea flux.1, flux.1 model, flux.1 vs stable diffusion, flux.1 vs midjourney, flux.1 open source, flux.1 download, flux.1 github, flux.1 hugging face",
  };
}

export default async function FluxAIPage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "FluxAIPage" });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          {t("title")}
        </h1>
        <p className="text-xl text-muted-foreground mb-6">
          {t("description")}
        </p>
        <Button asChild size="lg" className="mr-4">
          <Link href="/app/generate">{t("tryButton")}</Link>
        </Button>
      </div>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("whatIs.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              {t("whatIs.content1")}
            </p>
            <p>
              {t("whatIs.content2")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("whyRevolutionary.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">{t("whyRevolutionary.quality.title")}</h3>
                <p className="text-muted-foreground">
                  {t("whyRevolutionary.quality.description")}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">{t("whyRevolutionary.speed.title")}</h3>
                <p className="text-muted-foreground">
                  {t("whyRevolutionary.speed.description")}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">{t("whyRevolutionary.free.title")}</h3>
                <p className="text-muted-foreground">
                  {t("whyRevolutionary.free.description")}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">{t("whyRevolutionary.opensource.title")}</h3>
                <p className="text-muted-foreground">
                  {t("whyRevolutionary.opensource.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("comparison.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">{t("comparison.headers.feature")}</th>
                    <th className="text-left p-2">{t("comparison.headers.flux")}</th>
                    <th className="text-left p-2">{t("comparison.headers.sd3")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium">{t("comparison.rows.speed.feature")}</td>
                    <td className="p-2">{t("comparison.rows.speed.flux")}</td>
                    <td className="p-2">{t("comparison.rows.speed.sd3")}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">{t("comparison.rows.cost.feature")}</td>
                    <td className="p-2">{t("comparison.rows.cost.flux")}</td>
                    <td className="p-2">{t("comparison.rows.cost.sd3")}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">{t("comparison.rows.license.feature")}</td>
                    <td className="p-2">{t("comparison.rows.license.flux")}</td>
                    <td className="p-2">{t("comparison.rows.license.sd3")}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">{t("comparison.rows.prompt.feature")}</td>
                    <td className="p-2">{t("comparison.rows.prompt.flux")}</td>
                    <td className="p-2">{t("comparison.rows.prompt.sd3")}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">{t("comparison.rows.quality.feature")}</td>
                    <td className="p-2">{t("comparison.rows.quality.flux")}</td>
                    <td className="p-2">{t("comparison.rows.quality.sd3")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("variants.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-2">{t("variants.pro.title")}</h3>
                <p className="text-muted-foreground mb-4">{t("variants.pro.subtitle")}</p>
                <p className="text-sm">
                  {t("variants.pro.description")}
                </p>
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-2">{t("variants.dev.title")}</h3>
                <p className="text-muted-foreground mb-4">{t("variants.dev.subtitle")}</p>
                <p className="text-sm">
                  {t("variants.dev.description")}
                </p>
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-2">{t("variants.schnell.title")}</h3>
                <p className="text-muted-foreground mb-4">{t("variants.schnell.subtitle")}</p>
                <p className="text-sm">
                  {t("variants.schnell.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("howBuilt.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              {t("howBuilt.description")}
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold mb-2">{t("howBuilt.principles.accessibility.title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("howBuilt.principles.accessibility.description")}
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">{t("howBuilt.principles.performance.title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("howBuilt.principles.performance.description")}
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">{t("howBuilt.principles.quality.title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("howBuilt.principles.quality.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">{t("cta.title")}</h2>
          <p className="text-lg mb-6">
            {t("cta.description")}
          </p>
          <div className="space-x-4">
            <Button asChild size="lg">
              <Link href="/app/generate">{t("cta.generateButton")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="https://github.com/krea-ai/flux">{t("cta.githubButton")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 