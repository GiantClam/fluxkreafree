#!/usr/bin/env node

/**
 * Cloudflare Pages + Functions 构建脚本
 * 使用 @cloudflare/next-on-pages 将 Next.js 转换为 Pages Functions
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function buildForPages() {
  console.log('🚀 开始构建 Cloudflare Pages + Functions 应用...\n');

  try {
    // 1. 清理之前的构建
    console.log('🧹 清理之前的构建...');
    ['out', '.next', '.vercel'].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    // 2. 生成 Prisma 客户端
    console.log('🗄️ 生成 Prisma 客户端...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // 3. 构建 Next.js 应用
    console.log('🔨 构建 Next.js 应用...');
    execSync('npm run build', { stdio: 'inherit' });

    // 4. 转换为 Cloudflare Pages
    console.log('⚡ 转换为 Cloudflare Pages Functions...');
    execSync('npx @cloudflare/next-on-pages', { stdio: 'inherit' });

    // 5. 验证构建输出
    const distDir = '.vercel/output';
    if (!fs.existsSync(distDir)) {
      throw new Error(`Pages 构建目录 ${distDir} 不存在`);
    }

    console.log('\n✅ Pages + Functions 构建完成！');
    console.log(`📁 构建输出目录: ${path.resolve(distDir)}`);
    
    // 6. 提供部署说明
    console.log('\n🎉 构建成功！可以部署了！\n');
    console.log('📋 部署方法：');
    console.log('  方法一 - Wrangler CLI（推荐）：');
    console.log('    npx wrangler pages deploy');
    console.log('');
    console.log('  方法二 - Cloudflare Dashboard：');
    console.log('    1. 登录 Cloudflare Dashboard');
    console.log('    2. 进入 Workers & Pages');
    console.log('    3. 上传 .vercel/output 目录');
    console.log('');
    console.log('🔧 重要提醒：');
    console.log('  - 确保已配置环境变量');
    console.log('  - 确保 wrangler.toml 中的绑定 ID 正确');
    console.log('  - 数据库需要先运行迁移');

  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    console.log('\n🔍 常见解决方案：');
    console.log('  1. 检查环境变量是否完整');
    console.log('  2. 确保 Cloudflare 绑定配置正确');
    console.log('  3. 运行 npm run check-config 验证配置');
    process.exit(1);
  }
}

buildForPages(); 