import { PrismaClient } from "@prisma/client";

// 在开发和生产模式下都使用全局缓存，避免创建多个 Prisma 客户端实例
// 这在 Vercel 等 serverless 环境中特别重要，因为每次函数调用可能创建新实例
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

// 数据库连接管理类
class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  private constructor() {
    // 在开发和生产模式下都使用全局缓存，避免创建多个 Prisma 客户端实例
    // 这在 Vercel 等 serverless 环境中特别重要，因为每次函数调用可能创建新实例
    if (!global.__prisma__) {
      // 获取数据库 URL，如果是 PostgreSQL，添加参数来避免 prepared statement 冲突
      let databaseUrl = process.env.DATABASE_URL || '';
      
      // 如果是 PostgreSQL 连接，优化配置以支持 Supabase 和 serverless 环境
      if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
        try {
          const urlObj = new URL(databaseUrl);
          const hostname = urlObj.hostname.toLowerCase();
          
          // 检测 Supabase 连接
          const isSupabase = hostname.includes('supabase.co') || hostname.includes('supabase.com');
          
          // 在 Vercel serverless 环境中，Supabase 必须使用连接池模式
          // 这是解决 prepared statement 冲突的关键
          if ((process.env.VERCEL || process.env.NODE_ENV === 'production') && isSupabase) {
            const hasPooler = hostname.includes('pooler');
            const hasPgBouncerParam = urlObj.searchParams.has('pgbouncer');
            
            if (!hasPooler && !hasPgBouncerParam) {
              // Supabase 连接池 URL 格式：db.xxx.pooler.supabase.com:6543
              // 将 db.xxx.supabase.co 替换为 db.xxx.pooler.supabase.com
              if (hostname.includes('.supabase.co')) {
                // 提取项目引用 ID（db.xxx.supabase.co 中的 xxx）
                const match = hostname.match(/^db\.([^.]+)\.supabase\.co$/);
                if (match) {
                  const projectRef = match[1];
                  urlObj.hostname = `db.${projectRef}.pooler.supabase.com`;
                  // Supabase 连接池使用端口 6543
                  urlObj.port = '6543';
                  // 添加 pgbouncer 参数（必需）
                  urlObj.searchParams.set('pgbouncer', 'true');
                  databaseUrl = urlObj.toString();
                  console.log(`✅ Supabase 连接已转换为连接池模式: ${urlObj.hostname}:${urlObj.port}`);
                } else {
                  // 如果格式不匹配，至少添加 pgbouncer 参数
                  urlObj.searchParams.set('pgbouncer', 'true');
                  databaseUrl = urlObj.toString();
                  console.log('⚠️ Supabase 连接格式不匹配，已添加 pgbouncer 参数');
                }
              } else if (hostname.includes('.supabase.com')) {
                // 处理 .supabase.com 域名
                const match = hostname.match(/^db\.([^.]+)\.supabase\.com$/);
                if (match) {
                  const projectRef = match[1];
                  urlObj.hostname = `db.${projectRef}.pooler.supabase.com`;
                  urlObj.port = '6543';
                  urlObj.searchParams.set('pgbouncer', 'true');
                  databaseUrl = urlObj.toString();
                  console.log(`✅ Supabase 连接已转换为连接池模式: ${urlObj.hostname}:${urlObj.port}`);
                } else {
                  urlObj.searchParams.set('pgbouncer', 'true');
                  databaseUrl = urlObj.toString();
                  console.log('⚠️ Supabase 连接格式不匹配，已添加 pgbouncer 参数');
                }
              } else {
                // 如果无法识别，添加 pgbouncer 参数
                urlObj.searchParams.set('pgbouncer', 'true');
                databaseUrl = urlObj.toString();
                console.log('⚠️ 无法识别 Supabase 连接格式，已添加 pgbouncer 参数');
              }
            } else {
              console.log('✅ 检测到 Supabase 连接池 URL（已配置）');
            }
          } else if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
            // 非 Supabase 的 PostgreSQL 连接，检查是否使用连接池
            const hasPgBouncer = hostname.includes('pgbouncer') || 
                                 urlObj.searchParams.has('pgbouncer') ||
                                 hostname.includes('pooler');
            if (!hasPgBouncer) {
              console.log('⚠️ 在 serverless 环境中，建议使用连接池（PgBouncer）以避免 prepared statement 冲突');
            }
          }
          
          databaseUrl = urlObj.toString();
        } catch (e) {
          // URL 解析失败，使用原始 URL
          console.warn('无法解析 DATABASE_URL，使用原始 URL');
        }
      }
      
      global.__prisma__ = new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        // 配置连接池以避免 prepared statement 冲突
        // Prisma 会自动管理连接池，但我们可以通过环境变量配置
      });
      
      const env = process.env.NODE_ENV === 'development' ? '开发' : '生产';
      console.log(`✅ ${env}模式：创建全局缓存的 Prisma 客户端`);
    }
    
    this.prisma = global.__prisma__;

    // 设置连接事件监听
    this.setupEventListeners();
  }

  public static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  private setupEventListeners() {
    // 移除不兼容的事件监听器，只保留基本的错误处理
    console.log('✅ 数据库连接管理器初始化完成');
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  // 带重试机制的数据库操作
  public async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // 检查是否是预处理语句错误或其他连接相关错误
        if (this.isRetryableError(error)) {
          const errorCode = error?.code || '';
          const errorMessage = error?.message || '';
          
          // 对于 prepared statement 错误，使用更长的等待时间
          const isPreparedStatementError = errorCode === '42P05' || errorMessage.includes('prepared statement');
          
          if (attempt < maxRetries) {
            console.warn(`数据库操作重试 ${attempt}/${maxRetries}: ${errorMessage.substring(0, 100)}`);
            
            // 对于 prepared statement 错误，使用更长的等待时间让连接池清理
            const waitTime = isPreparedStatementError 
              ? delay * Math.pow(2, attempt) * 2  // 更长的等待时间
              : delay * Math.pow(2, attempt - 1);
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // 如果不是可重试的错误，直接抛出
        throw error;
      }
    }
    
    throw lastError;
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'prepared statement',
      '42P05', // PostgreSQL prepared statement already exists
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
    ];

    return retryableErrors.some(pattern => 
      error?.message?.includes(pattern) || 
      error?.code === pattern
    );
  }

  // 健康检查
  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('数据库健康检查失败:', error);
      return false;
    }
  }

  // 优雅关闭
  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      console.log('数据库连接已关闭');
    } catch (error) {
      console.error('关闭数据库连接时出错:', error);
    }
  }
}

// 导出单例实例
export const dbManager = DatabaseConnectionManager.getInstance();
export const prisma = dbManager.getClient();

// 导出便捷的重试函数
export const withRetry = dbManager.withRetry.bind(dbManager); 