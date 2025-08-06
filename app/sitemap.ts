import { MetadataRoute } from "next";
import { prisma } from "@/db/prisma";
import { FluxTaskStatus } from "@/db/type";
import { FluxHashids } from "@/db/dto/flux.dto";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

import { allPosts } from "contentlayer/generated";

import { defaultLocale, locales, pathnames } from "@/config";
import { env } from "@/env.mjs";
import { getPathname } from "@/lib/navigation";

const getFluxUrl = async () => {
  // 在构建时或没有数据库连接时返回空数组
  if (shouldSkipDatabaseQuery()) {
    return [];
  }

  try {
    const fluxs = await prisma.fluxData.findMany({
      where: {
        isPrivate: false,
        taskStatus: {
          in: [FluxTaskStatus.Succeeded],
        },
      },
      select: {
        id: true
      }
    });
    return fluxs.map((flux) => `/d/${FluxHashids.encode(flux.id)}`)
  } catch (error) {
    console.error("❌ getFluxUrl 数据库查询错误:", error);
    return [];
  }
}
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const keys = Object.keys(pathnames) as Array<keyof typeof pathnames>;
  const posts = await Promise.all(
    allPosts
      .filter((post) => post.published && post.language === defaultLocale)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((post) => post.slug?.replace(`/${defaultLocale}`, "")),
  );
  // 在构建时或没有数据库连接时使用默认值
  let fluxDataCount = 0;
  if (!shouldSkipDatabaseQuery()) {
    try {
      fluxDataCount = await prisma.fluxData.count({
        where: {
          isPrivate: false,
          taskStatus: {
            in: [FluxTaskStatus.Succeeded],
          },
        }
      });
    } catch (error) {
      console.error("❌ sitemap fluxDataCount 数据库查询错误:", error);
      fluxDataCount = 0;
    }
  }
  const pageCount = Math.ceil(fluxDataCount / 24);
  const explorePages = Array.from({ length: pageCount }, (_, i) => i === 0 ? `/explore` : `/explore/${i + 1}`);

  function getUrl(
    key: keyof typeof pathnames,
    locale: (typeof locales)[number],
  ) {
    const pathname = getPathname({ locale, href: key });
    return `${env.NEXT_PUBLIC_SITE_URL}/${locale === defaultLocale ? "" : locale}${pathname === "/" ? "" : pathname}`;
  }

  // return [...posts, ...keys].map((key) => ({
  //   url: getUrl(key, defaultLocale),
  //   priority: 0.7,
  //   changeFrequency: 'daily',
  //   alternates: {
  //     languages: Object.fromEntries(
  //       locales.map((locale) => [locale, getUrl(key, locale)]),
  //     ),
  //   },
  // }));
  const fluxUrls = await getFluxUrl();

  return [...posts, ...keys, ...fluxUrls, ...explorePages].flatMap((key) =>
    locales.map((locale) => ({
      url: getUrl(key, locale),
      priority: 0.7,
      changeFrequency: "daily",
    })),
  );
}
