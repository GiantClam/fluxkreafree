import { PrismaClient } from "@prisma/client";

// 数据库连接管理类
class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  private constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

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
          console.warn(`数据库操作重试 ${attempt}/${maxRetries}:`, error.message);
          
          if (attempt < maxRetries) {
            // 指数退避策略
            const waitTime = delay * Math.pow(2, attempt - 1);
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