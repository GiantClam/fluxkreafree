import { LocalePrefix, Pathnames } from "next-intl/routing";

export const defaultLocale = "en" as const;
export const locales = [
  "en",
  "zh",
  "tw",
  "fr",
  "ja",
  "ko",
  "de",
  "pt",
  "es",
  "ar",
] as const;

export type Locale = (typeof locales)[number];

// 简化路径配置，只保留必要的路径映射
export const pathnames: Pathnames<typeof locales> = {
  "/": "/",
  "/blog": "/blog",
  "/flux-schnell": "/flux-schnell",
  "/flux-prompt-generator": "/flux-prompt-generator",
};

// API 路由不应该有国际化前缀
export const localePrefix: LocalePrefix<typeof locales> = "always";

export const port = process.env.PORT || 3000;
export const host = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${port}`;
