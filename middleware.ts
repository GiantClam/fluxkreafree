import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { withAuth } from "next-auth/middleware";

import { kvKeys } from "@/config/kv";
import { env } from "@/env.mjs";
import countries from "@/lib/countries.json";
import { getIP } from "@/lib/ip";
import { redis } from "@/lib/redis";
import { isCloudflareEnvironment } from "@/lib/cloudflare-bindings";

import { defaultLocale, localePrefix, locales } from "./config";

export const config = {
  matcher: [
    "/",
    "/(zh|en|tw|fr|ja|ko|de|pt|es|ar)/:path*",
    // 排除 API 路由、静态文件和 Next.js 内部文件
    // 注意：API 路由不应该匹配，因为它们不应该有国际化前缀
    // 使用负向前瞻确保 API 路由不被匹配
    "/((?!api|_next|static|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};

// Custom route matcher to replace Clerk's createRouteMatcher
function createRouteMatcher(routes: string[]) {
  return (req: NextRequest) => {
    const { pathname } = req.nextUrl;
    return routes.some(route => {
      // Convert route pattern to regex
      const pattern = route
        .replace(/\(.*\)/g, ".*") // Replace (.*) with .*
        .replace(/:locale/g, `(${locales.join("|")})`) // Replace :locale with actual locales
        .replace(/\*/g, ".*"); // Replace * with .*
      
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(pathname);
    });
  };
}

const isProtectedRoute = createRouteMatcher([
  "/:locale/app(.*)",
  "/:locale/admin(.*)",
]);
const isPublicRoute = createRouteMatcher(["/api/webhooks(.*)"]);

const nextIntlMiddleware = createMiddleware({
  defaultLocale,
  locales,
  localePrefix,
  // 排除 API 路由，确保它们不被国际化处理
  localeDetection: false,
});

export default withAuth(
  async function middleware(req) {
    const { geo, nextUrl } = req;
    const pathname = nextUrl.pathname;
    const isApi = pathname.startsWith("/api/");
    
    // API 路由：直接返回 NextResponse，不进行国际化处理
    // 这确保 API 路由不会被 next-intl 添加语言前缀
    if (isApi) {
      return NextResponse.next();
    }
    
    // 开发模式：如果启用了开发用户，跳过认证检查
    const enableDevUser = env.ENABLE_DEV_USER === "true" || env.ENABLE_DEV_USER === "1";
    const isDevelopment = process.env.NODE_ENV === "development";
    
    if (isPublicRoute(req)) {
      return;
    }
    
    // 开发模式下，如果启用了开发用户，直接通过中间件
    if (enableDevUser && isDevelopment) {
      return nextIntlMiddleware(req);
    }
    
    // 在 Cloudflare Workers 环境中，我们可以使用环境变量或 KV 来存储被阻止的 IP
    // 暂时禁用 IP 阻止功能，直到我们实现 Cloudflare 兼容的版本
    if (false && env.VERCEL_ENV !== "development") {
      const ip = getIP(req);
      console.log("ip-->", ip);

      // TODO: 实现 Cloudflare 兼容的 IP 阻止功能
      // const blockedIPs = await getBlockedIPsFromKV();
      
      // if (blockedIPs?.includes(ip)) {
      //   if (isApi) {
      //     return NextResponse.json(
      //       { error: "You have been blocked." },
      //       { status: 403 },
      //     );
      //   }

      //   nextUrl.pathname = "/blocked";
      //   return NextResponse.rewrite(nextUrl);
      // }

      // if (nextUrl.pathname === "/blocked") {
      //   nextUrl.pathname = "/";
      //   return NextResponse.redirect(nextUrl);
      // }
    }

    // 检测并记录访问者信息（支持Cloudflare和传统环境）
    if (geo && !isApi && env.VERCEL_ENV !== "development") {
      console.log("geo-->", geo);
      const country = geo.country;
      const city = geo.city;

      const countryInfo = countries.find((x) => x.cca2 === country);
      if (countryInfo) {
        const flag = countryInfo.flag;
        try {
          // 判断是否在Cloudflare环境中运行
          if (isCloudflareEnvironment() && (req as any).cf && (req as any).cf.env?.KV) {
            // 在Cloudflare Worker环境中使用绑定
            console.log('🌐 Middleware: 使用Cloudflare KV绑定存储访问者信息');
            const kv = (req as any).cf.env.KV;
            await kv.put(kvKeys.currentVisitor, JSON.stringify({ country, city, flag }));
          } else {
            // 在传统环境中使用redis客户端
            console.log('💻 Middleware: 使用Redis存储访问者信息');
            await redis.set(kvKeys.currentVisitor, { country, city, flag });
          }
        } catch (error) {
          console.error('⚠️ 存储访问者信息失败:', error);
        }
      }
    }
    
    if (isApi) {
      return;
    }

    return nextIntlMiddleware(req);
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // API 路由：直接允许，不进行认证检查（API 路由有自己的认证逻辑）
        if (req.nextUrl.pathname.startsWith("/api/")) {
          return true;
        }
        
        // 开发模式：如果启用了开发用户，允许所有访问
        const enableDevUser = env.ENABLE_DEV_USER === "true" || env.ENABLE_DEV_USER === "1";
        const isDevelopment = process.env.NODE_ENV === "development";
        
        if (enableDevUser && isDevelopment) {
          return true;
        }
        
        // If it's a public route, allow access
        if (isPublicRoute(req)) {
          return true;
        }
        
        // If it's a protected route, require authentication
        if (isProtectedRoute(req)) {
          return !!token;
        }
        
        // For all other routes, allow access
        return true;
      },
    },
  }
);
