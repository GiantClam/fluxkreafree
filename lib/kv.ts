import { env } from "@/env.mjs";

// 检测是否在构建时（静态生成）
const isBuildTime = process.env.NODE_ENV === 'production' && process.env.VERCEL === undefined && process.env.CF_PAGES === undefined;

interface KVClient {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any, options?: { ex?: number }): Promise<string>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  exists(key: string): Promise<number>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  pipeline(): {
    exec(): Promise<any[]>;
  };
}

// 构建时模拟 KV 客户端
class MockKVClient implements KVClient {
  async get<T = any>(key: string): Promise<T | null> {
    console.log(`[Mock KV] GET ${key} - returning null (build time)`);
    return null;
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<string> {
    console.log(`[Mock KV] SET ${key} - skipped (build time)`);
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    console.log(`[Mock KV] INCR ${key} - returning 1 (build time)`);
    return 1;
  }

  async expire(key: string, seconds: number): Promise<number> {
    console.log(`[Mock KV] EXPIRE ${key} - skipped (build time)`);
    return 1;
  }

  async exists(key: string): Promise<number> {
    console.log(`[Mock KV] EXISTS ${key} - returning 0 (build time)`);
    return 0;
  }

  async del(key: string): Promise<number> {
    console.log(`[Mock KV] DEL ${key} - skipped (build time)`);
    return 1;
  }

  async keys(pattern: string): Promise<string[]> {
    console.log(`[Mock KV] KEYS ${pattern} - returning empty array (build time)`);
    return [];
  }

  pipeline() {
    return {
      exec: async () => {
        console.log(`[Mock KV] PIPELINE - skipped (build time)`);
        return [];
      }
    };
  }
}

// Workers 绑定 KV 客户端（用于 Cloudflare 部署）
class WorkersKVClient implements KVClient {
  private kv: any;

  constructor(kvBinding: any) {
    this.kv = kvBinding;
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key);
      if (value === null) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error('Workers KV get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<string> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (options?.ex) {
        await this.kv.put(key, stringValue, { expirationTtl: options.ex });
      } else {
        await this.kv.put(key, stringValue);
      }
      
      return 'OK';
    } catch (error) {
      console.error('Workers KV set error:', error);
      return 'ERROR';
    }
  }

  async incr(key: string): Promise<number> {
    try {
      const current = await this.get<number>(key);
      const newValue = (current || 0) + 1;
      await this.set(key, newValue);
      return newValue;
    } catch (error) {
      console.error('Workers KV incr error:', error);
      return 1;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    try {
      const value = await this.get(key);
      if (value === null) return 0;
      
      await this.set(key, value, { ex: seconds });
      return 1;
    } catch (error) {
      console.error('Workers KV expire error:', error);
      return 0;
    }
  }

  async exists(key: string): Promise<number> {
    try {
      const value = await this.get(key);
      return value !== null ? 1 : 0;
    } catch (error) {
      console.error('Workers KV exists error:', error);
      return 0;
    }
  }

  async del(key: string): Promise<number> {
    try {
      await this.kv.delete(key);
      return 1;
    } catch (error) {
      console.error('Workers KV del error:', error);
      return 0;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      const list = await this.kv.list({ prefix: pattern });
      return list.keys.map((key: any) => key.name);
    } catch (error) {
      console.error('Workers KV keys error:', error);
      return [];
    }
  }

  pipeline() {
    // KV 不支持管道操作，返回一个模拟的管道
    return {
      exec: async () => []
    };
  }
}

// Cloudflare API KV 客户端（用于本地开发）
class CloudflareKVClient implements KVClient {
  private namespace: string;
  private accountId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(namespace: string, accountId: string, apiToken: string) {
    this.namespace = namespace;
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespace}`;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`KV API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const response = await fetch(`${this.baseUrl}/values/${encodeURIComponent(key)}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`KV get failed: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text) return null;

      // Cloudflare KV API 返回的是 JSON 格式，包含 value 字段
      try {
        const jsonResponse = JSON.parse(text);
        // 如果响应包含 value 字段，提取它
        if (jsonResponse && typeof jsonResponse === 'object' && 'value' in jsonResponse) {
          const value = jsonResponse.value;
          // 尝试解析 value 为 JSON
          try {
            return JSON.parse(value);
          } catch {
            return value as T;
          }
        }
        // 如果没有 value 字段，直接返回解析后的 JSON
        return jsonResponse;
      } catch {
        // 如果不是 JSON，直接返回文本
        return text as T;
      }
    } catch (error) {
      console.error('KV get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<string> {
    try {
      const body = {
        value: typeof value === 'string' ? value : JSON.stringify(value),
        ...(options?.ex && { expiration_ttl: options.ex }),
      };

      const response = await fetch(`${this.baseUrl}/values/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`KV set failed: ${response.status} ${response.statusText}`);
      }

      return 'OK';
    } catch (error) {
      console.error('KV set error:', error);
      return 'ERROR';
    }
  }

  async incr(key: string): Promise<number> {
    try {
      const current = await this.get<number>(key);
      const newValue = (current || 0) + 1;
      await this.set(key, newValue);
      return newValue;
    } catch (error) {
      console.error('KV incr error:', error);
      return 1;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    try {
      const value = await this.get(key);
      if (value === null) return 0;
      
      await this.set(key, value, { ex: seconds });
      return 1;
    } catch (error) {
      console.error('KV expire error:', error);
      return 0;
    }
  }

  async exists(key: string): Promise<number> {
    try {
      const value = await this.get(key);
      return value !== null ? 1 : 0;
    } catch (error) {
      console.error('KV exists error:', error);
      return 0;
    }
  }

  async del(key: string): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/values/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });

      if (response.status === 404) {
        return 0;
      }

      if (!response.ok) {
        throw new Error(`KV del failed: ${response.status} ${response.statusText}`);
      }

      return 1;
    } catch (error) {
      console.error('KV del error:', error);
      return 0;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      const response = await this.request('GET', `/keys${pattern ? `?prefix=${encodeURIComponent(pattern)}` : ''}`);
      return response.result?.map((item: any) => item.name) || [];
    } catch (error) {
      console.error('KV keys error:', error);
      return [];
    }
  }

  pipeline() {
    // KV 不支持管道操作，返回一个模拟的管道
    return {
      exec: async () => []
    };
  }
}

// 创建 KV 客户端实例 - 支持三种模式
const createKVClient = (kvBinding?: any): KVClient => {
  // 构建时使用模拟客户端
  if (isBuildTime) {
    console.log('🏗️ 使用构建时模拟 KV 客户端');
    return new MockKVClient();
  }

  // 在 Cloudflare Workers/Pages 环境中，优先使用 Workers 绑定
  if (kvBinding) {
    console.log('🌐 使用 Cloudflare Workers KV 绑定');
    return new WorkersKVClient(kvBinding);
  }

  // 在本地开发环境中，检查环境变量
  const namespaceId = env.CLOUDFLARE_KV_NAMESPACE_ID;
  const accountId = env.CLOUDFLARE_KV_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_KV_API_TOKEN;
  
  if (!namespaceId || !accountId || !apiToken || 
      namespaceId.includes('placeholder') || 
      accountId.includes('placeholder') || 
      apiToken.includes('placeholder')) {
    // 在构建过程中，如果缺少配置，使用模拟客户端而不是抛出错误
    if (process.env.NODE_ENV === 'production') {
      console.log('🏗️ 生产构建时使用模拟 KV 客户端（配置不完整）');
      return new MockKVClient();
    }
    
    throw new Error(`
      🔧 本地开发环境 Cloudflare KV 配置不完整！
      
      请在 .env.local 中设置以下环境变量：
      - CLOUDFLARE_KV_NAMESPACE_ID=${namespaceId || '你的KV命名空间ID'}
      - CLOUDFLARE_KV_ACCOUNT_ID=${accountId || '你的账户ID'}  
      - CLOUDFLARE_KV_API_TOKEN=${apiToken || '你的API_Token'}
      
      💡 获取这些值：
      1. 运行: wrangler kv:namespace create "next-money-kv"
      2. 复制返回的 Namespace ID
      3. 运行: wrangler whoami 查看 Account ID
      4. 在 Cloudflare Dashboard 创建 API Token
      
      📝 或者复制 env.template 为 .env.local 并按照 CLOUDFLARE_QUICK_SETUP.md 填写
      
      🚀 部署到 Cloudflare 时将自动使用 wrangler.toml 中的绑定配置
    `);
  }
  
  console.log('💻 使用本地开发模式 - Cloudflare API 调用');
  return new CloudflareKVClient(namespaceId, accountId, apiToken);
};

// 导出客户端实例
// 在 Workers 环境中可以传入 env.KV，在本地环境中自动使用环境变量
export const kv = createKVClient();

// 用于 Workers 环境的辅助函数
export const createKVFromBinding = (kvBinding: any): KVClient => {
  return createKVClient(kvBinding);
};

// 基于 KV 的速率限制器实现
interface RateLimitOptions {
  limit: number;
  window: string; // 时间窗口，如 "10s", "1m", "1h"
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: Date;
  pending: Promise<unknown>;
}

export class KVRateLimit {
  private client: KVClient;
  private options: RateLimitOptions;

  constructor(client: KVClient, options: RateLimitOptions) {
    this.client = client;
    this.options = options;
  }

  private parseWindow(window: string): number {
    const match = window.match(/^(\d+)\s*([smhd])$/);
    if (!match) throw new Error(`Invalid window format: ${window}`);
    
    const [, num, unit] = match;
    const value = parseInt(num, 10);
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: throw new Error(`Invalid window unit: ${unit}`);
    }
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    const windowSeconds = this.parseWindow(this.options.window);
    const now = Date.now();
    const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);
    const key = `ratelimit:${identifier}:${windowStart}`;

    try {
      const current = await this.client.get<number>(key) || 0;
      const remaining = Math.max(0, this.options.limit - current - 1);
      
      if (current >= this.options.limit) {
        return {
          success: false,
          remaining: 0,
          reset: new Date(windowStart + windowSeconds * 1000),
          pending: Promise.resolve(),
        };
      }

      // 增加计数器
      const newCount = current + 1;
      await this.client.set(key, newCount, { ex: windowSeconds });

      return {
        success: true,
        remaining,
        reset: new Date(windowStart + windowSeconds * 1000),
        pending: Promise.resolve(),
      };
    } catch (error) {
      console.error('Rate limit error:', error);
      // 出错时允许请求通过，避免阻塞
      return {
        success: true,
        remaining: this.options.limit - 1,
        reset: new Date(windowStart + windowSeconds * 1000),
        pending: Promise.resolve(),
      };
    }
  }
}

// 创建速率限制器实例
export const ratelimit = new KVRateLimit(kv, {
  limit: 30,
  window: "10s"
}); 