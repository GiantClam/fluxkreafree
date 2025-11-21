"use client";

import { useTranslations } from "next-intl";
import { GiftIcon, SparklesIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import { Icons } from "@/components/shared/icons";

export default function CreditsRewards() {
  const t = useTranslations("IndexPage.creditsRewards");

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-purple-950/20 dark:via-background dark:to-pink-950/20">
      <div className="container mx-auto max-w-screen-xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <MaxWidthWrapper>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400">
              <SparklesIcon className="size-4" />
              <span>{t("badge")}</span>
            </div>
            
            <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t("title")}
            </h2>
            
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {t("description")}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {/* 注册奖励卡片 */}
            <div className="group relative overflow-hidden rounded-2xl border bg-background p-6 shadow-lg transition-all hover:shadow-xl md:p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="flex size-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <GiftIcon className="size-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">
                  {t("signup.title")}
                </h3>
                <p className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {t("signup.amount")}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("signup.description")}
                </p>
              </div>
            </div>

            {/* 每日登录奖励卡片 */}
            <div className="group relative overflow-hidden rounded-2xl border bg-background p-6 shadow-lg transition-all hover:shadow-xl md:p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-purple-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="flex size-12 items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-900/30">
                  <SparklesIcon className="size-6 text-pink-600 dark:text-pink-400" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">
                  {t("daily.title")}
                </h3>
                <p className="mt-2 text-2xl font-bold text-pink-600 dark:text-pink-400">
                  {t("daily.amount")}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("daily.description")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signin"
              className={cn(
                buttonVariants({ size: "lg" }),
                "min-w-48 gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700",
              )}
            >
              <span>{t("cta.signup")}</span>
              <Icons.arrowRight className="size-4" />
            </Link>
            <Link
              href="/blog/free-credits-signup-daily-login-rewards"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "min-w-48 gap-2 rounded-full",
              )}
            >
              <span>{t("cta.learnMore")}</span>
              <Icons.arrowUpRight className="size-4" />
            </Link>
          </div>

          <div className="mt-8 rounded-xl border bg-muted/50 p-6">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-around">
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {t("stats.total")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("stats.totalLabel")}
                </div>
              </div>
              <div className="hidden h-12 w-px bg-border sm:block" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {t("stats.daily")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("stats.dailyLabel")}
                </div>
              </div>
              <div className="hidden h-12 w-px bg-border sm:block" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {t("stats.free")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("stats.freeLabel")}
                </div>
              </div>
            </div>
          </div>
        </MaxWidthWrapper>
      </div>
    </section>
  );
}

