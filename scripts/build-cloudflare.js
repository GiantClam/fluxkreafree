#!/usr/bin/env node

/**
 * Cloudflare Workers 构建脚本
 * 构建 Next.js 应用并准备部署到 Cloudflare Workers
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function buildForCloudflare() {
  console.log('🚀 开始构建 Cloudflare Workers 应用...\n');

  try {
    // 1. 清理之前的构建
    console.log('🧹 清理之前的构建...');
    if (fs.existsSync('.next')) {
      fs.rmSync('.next', { recursive: true, force: true });
    }

    // 2. 生成 Prisma 客户端
    console.log('🗄️ 生成 Prisma 客户端...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // 3. 构建 Next.js 应用（standalone 模式）
    console.log('🔨 构建 Next.js 应用（standalone 模式）...');
    execSync('npm run build', { stdio: 'inherit' });

    // 4. 检查构建输出目录
    const buildDir = '.next/standalone';
    const staticDir = '.next/static';
    
    if (!fs.existsSync(buildDir)) {
      throw new Error(`构建目录 ${buildDir} 不存在`);
    }

    console.log('✅ Next.js 构建完成！');
    console.log(`📁 Standalone 构建目录: ${path.resolve(buildDir)}`);
    console.log(`📁 静态资源目录: ${path.resolve(staticDir)}`);
    
    // 5. 提供 Cloudflare Pages 部署说明
    console.log('\n🎉 构建完成！\n');
    console.log('📋 部署说明:');
    console.log('  这是一个 Next.js standalone 构建，推荐部署方式：\n');
    console.log('  🌐 Cloudflare Pages (推荐):');
    console.log('    1. 确保你的 wrangler.toml 配置正确');
    console.log('    2. 运行: npx wrangler pages deploy .next/standalone');
    console.log('    3. 或使用 Cloudflare Dashboard 上传整个 .next/standalone 目录\n');
    console.log('  ⚡ Cloudflare Workers (高级):');
    console.log('    1. 使用 @cloudflare/next-on-pages 转换');
    console.log('    2. 运行: npx @cloudflare/next-on-pages');
    console.log('    3. 然后: npx wrangler deploy\n');
    
    console.log('🔧 当前配置信息:');
    console.log(`  - Next.js 模式: standalone`);
    console.log(`  - 输出目录: ${buildDir}`);
    console.log(`  - 静态资源: ${staticDir}`);
    console.log(`  - 入口文件: cloudflare-worker.js`);

  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
  }
}

buildForCloudflare(); 