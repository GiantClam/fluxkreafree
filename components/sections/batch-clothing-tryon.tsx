"use client";

import { useTranslations } from "next-intl";
import { ShirtIcon, ZapIcon, DownloadIcon, CheckCircle2Icon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import { Icons } from "@/components/shared/icons";

export default function BatchClothingTryon() {
  const t = useTranslations("IndexPage.batchTryon");

  const features = [
    {
      icon: ShirtIcon,
      title: t("features.batch.title"),
      description: t("features.batch.description"),
    },
    {
      icon: ZapIcon,
      title: t("features.async.title"),
      description: t("features.async.description"),
    },
    {
      icon: DownloadIcon,
      title: t("features.download.title"),
      description: t("features.download.description"),
    },
    {
      icon: CheckCircle2Icon,
      title: t("features.quality.title"),
      description: t("features.quality.description"),
    },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-950/20 dark:via-background dark:to-indigo-950/20">
      <div className="container mx-auto max-w-screen-xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <MaxWidthWrapper>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              <ShirtIcon className="size-4" />
              <span>{t("badge")}</span>
            </div>
            
            <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t("title")}
            </h2>
            
            <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground">
              {t("description")}
            </p>
          </div>

          {/* 核心功能展示 */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-2xl border bg-background p-6 shadow-lg transition-all hover:shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="relative">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                      <Icon className="size-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 统计数据 */}
          <div className="mt-10 rounded-xl border bg-muted/50 p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">
                  {t("stats.items")}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {t("stats.itemsLabel")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">
                  {t("stats.time")}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {t("stats.timeLabel")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">
                  {t("stats.cost")}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {t("stats.costLabel")}
                </div>
              </div>
            </div>
          </div>

          {/* 应用场景 */}
          <div className="mt-10">
            <h3 className="text-center text-2xl font-semibold">
              {t("useCases.title")}
            </h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                t("useCases.case1.title"),
                t("useCases.case2.title"),
                t("useCases.case3.title"),
              ].map((title, index) => (
                <div
                  key={index}
                  className="rounded-lg border bg-background p-4 text-center"
                >
                  <p className="font-medium">{title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 行动按钮 */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={`/app/generate?model=clothing-tryon`}
              className={cn(
                buttonVariants({ size: "lg" }),
                "min-w-48 gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
              )}
            >
              <span>{t("cta.tryNow")}</span>
              <Icons.arrowRight className="size-4" />
            </Link>
            <Link
              href="/blog/batch-model-clothing-try-on"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "min-w-48 gap-2 rounded-full",
              )}
            >
              <span>{t("cta.learnMore")}</span>
              <Icons.arrowUpRight className="size-4" />
            </Link>
          </div>
        </MaxWidthWrapper>
      </div>
    </section>
  );
}

