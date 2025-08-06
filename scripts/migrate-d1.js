#!/usr/bin/env node

/**
 * D1 数据库迁移脚本
 * 将 Prisma schema 迁移到 Cloudflare D1 数据库
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function migrateD1() {
  console.log('🗄️ 开始 D1 数据库迁移...\n');

  try {
    // 1. 检查 wrangler.toml 配置
    console.log('📋 检查 wrangler.toml 配置...');
    if (!fs.existsSync('wrangler.toml')) {
      throw new Error('wrangler.toml 文件不存在');
    }

    // 2. 创建 D1 数据库（如果不存在）
    console.log('🏗️ 创建 D1 数据库...');
    try {
      execSync('npx wrangler d1 create remove-anything-db', { stdio: 'inherit' });
      console.log('✅ D1 数据库创建成功');
    } catch (error) {
      console.log('ℹ️ D1 数据库可能已存在，继续下一步...');
    }

    // 3. 生成 D1 迁移文件
    console.log('📝 生成 D1 迁移文件...');
    execSync('npx wrangler d1 migrations apply remove-anything-db --local', { stdio: 'inherit' });

    // 4. 应用迁移到本地开发环境
    console.log('🔄 应用迁移到本地开发环境...');
    execSync('npx wrangler d1 migrations apply remove-anything-db --local', { stdio: 'inherit' });

    // 5. 应用迁移到生产环境
    console.log('🚀 应用迁移到生产环境...');
    execSync('npx wrangler d1 migrations apply remove-anything-db', { stdio: 'inherit' });

    console.log('✅ D1 数据库迁移完成！');
    console.log('\n📋 下一步：');
    console.log('1. 运行 npm run build:cloudflare 构建应用');
    console.log('2. 运行 npx wrangler deploy 部署到 Cloudflare');

  } catch (error) {
    console.error('❌ D1 数据库迁移失败:', error.message);
    process.exit(1);
  }
}

migrateD1(); 