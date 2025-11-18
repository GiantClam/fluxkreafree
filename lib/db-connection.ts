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
      
      // 如果是 PostgreSQL 连接，添加参数来避免 prepared statement 缓存冲突
      if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
        try {
          const urlObj = new URL(databaseUrl);
          // 添加 connection_limit 和 pool_timeout 参数来优化连接池
          // 添加 ?pgbouncer=true 如果使用 PgBouncer
          // 或者添加 ?prepared_statements=false 来禁用 prepared statements（不推荐，性能较差）
          // 最佳实践：使用连接池管理器（如 PgBouncer）或确保只有一个 Prisma 实例
          if (!urlObj.searchParams.has('connection_limit')) {
            urlObj.searchParams.set('connection_limit', '10');
          }
          if (!urlObj.searchParams.has('pool_timeout')) {
            urlObj.searchParams.set('pool_timeout', '10');
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