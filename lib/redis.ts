/**
 * Redis 兼容层
 * 在 Cloudflare 环境中使用 KV，在传统环境中使用环境变量配置的KV
 */

import { kv, ratelimit as kvRateLimit } from './kv';

// 重新导出 KV 客户端作为 Redis 客户端
// 这允许现有代码继续使用 redis.xxx 而无需修改
export const redis = kv;

// 重新导出速率限制器
// 保持与原始 @upstash/ratelimit 的兼容性
export const ratelimit = kvRateLimit;
