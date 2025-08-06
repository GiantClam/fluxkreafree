import { type NextRequest } from 'next/server';
import { 
  CloudflareBindings, 
  createBindingsManager, 
  isCloudflareEnvironment 
} from '@/lib/cloudflare-bindings';

/**
 * Cloudflare Workers/Pages 绑定适配器
 * 用于从请求中提取 Cloudflare 绑定并提供统一的访问接口
 */
export function getCloudflareBindings(req: NextRequest): CloudflareBindings | undefined {
  // 1. 检查是否在 Cloudflare 环境中
  if (!isCloudflareEnvironment()) {
    return undefined;
  }

  // 2. 从请求中提取 Cloudflare 绑定
  // @ts-ignore - cf 属性在 Cloudflare Workers 环境中可用
  const bindings = req.cf?.env;
  if (!bindings) {
    console.log('⚠️ 在 Cloudflare 环境中未找到绑定');
    return undefined;
  }

  return {
    KV: bindings.KV,
    R2: bindings.R2,
    DB: bindings.DB,
    AI: bindings.AI,
  };
}

/**
 * 创建绑定管理器
 * 用于在 API 路由中访问 Cloudflare 服务
 */
export function createBindingsFromRequest(req: NextRequest) {
  const bindings = getCloudflareBindings(req);
  return createBindingsManager(bindings);
}

/**
 * 检查请求是否来自 Cloudflare 环境
 */
export function isCloudflareRequest(req: NextRequest): boolean {
  // @ts-ignore - cf 属性在 Cloudflare Workers 环境中可用
  return isCloudflareEnvironment() && !!req.cf?.env;
} 