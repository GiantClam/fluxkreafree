import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { withAuth } from "next-auth/middleware";

import { env } from "@/env.mjs";
import countries from "@/lib/countries.json";
import { getIP } from "@/lib/ip";

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

// 检查 NextAuth 配置是否可用
const isDevelopment = process.env.NODE_ENV === "development";
const hasNextAuthSecret = !!env.NEXTAUTH_SECRET;
const enableDevUser = env.ENABLE_DEV_USER === "true" || env.ENABLE_DEV_USER === "1";

// 在开发环境中，如果没有 NextAuth secret 且未启用开发用户，直接使用 nextIntlMiddleware
// 避免 withAuth 导致的配置错误重定向循环
const shouldUseWithAuth = hasNextAuthSecret || !isDevelopment || enableDevUser;

// 基础中间件函数
async function baseMiddleware(req: NextRequest) {
  const { geo, nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");
  
  // API 路由：直接返回 NextResponse，不进行国际化处理
  // 这确保 API 路由不会被 next-intl 添加语言前缀
  if (isApi) {
    return NextResponse.next();
  }
  
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  
  // 先应用 next-intl 中间件处理国际化路由（包括根路径重定向）
  // 这会自动将 / 重定向到 /en，并将所有路径添加语言前缀
  const response = nextIntlMiddleware(req);
  
  // 如果 next-intl 返回了重定向响应（如根路径重定向），直接返回
  if (response && (response.status === 307 || response.status === 308 || response.status === 301 || response.status === 302)) {
    return response;
  }
  
  // 开发模式下，如果启用了开发用户，直接通过
  if (enableDevUser && isDevelopment) {
    return response || NextResponse.next();
  }

  // 不再缓存访问者信息（项目只部署在 Vercel，不需要此功能）
  
  // 返回 next-intl 的处理结果
  return response || NextResponse.next();
}

// 根据配置决定是否使用 withAuth
export default shouldUseWithAuth
  ? withAuth(baseMiddleware, {
      callbacks: {
        authorized: ({ token, req }) => {
          // API 路由：直接允许，不进行认证检查（API 路由有自己的认证逻辑）
          if (req.nextUrl.pathname.startsWith("/api/")) {
            return true;
          }
          
          // 开发模式：如果启用了开发用户，允许所有访问
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
      // 移除 pages 配置，让 next-intl 处理路径
      // signIn 路径会在 next-intl 处理后自动包含语言前缀
    })
  : baseMiddleware;
