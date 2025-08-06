#!/usr/bin/env node

/**
 * Cloudflare 部署脚本
 * 自动化 Remove Anything AI 到 Cloudflare Pages 的部署流程
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 检查必需的环境变量
const requiredEnvVars = [
  'CLOUDFLARE_AI_GATEWAY_URL',
  'CLOUDFLARE_AI_GATEWAY_TOKEN',
  'REPLICATE_API_TOKEN',
  'GEMINI_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXTAUTH_SECRET'
];

function checkEnvironmentVariables() {
  console.log('🔍 检查环境变量...');
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 缺少必需的环境变量:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n请检查 .env.local 文件或 Cloudflare Pages 环境变量设置。');
    process.exit(1);
  }
  
  console.log('✅ 环境变量检查通过\n');
}

function runCommand(command, description) {
  console.log(`🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description}完成\n`);
  } catch (error) {
    console.error(`❌ ${description}失败:`, error.message);
    process.exit(1);
  }
}

function createCloudflareHeaders() {
  console.log('📝 创建 Cloudflare 头部配置...');
  
  const headersContent = `
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/api/*
  Cache-Control: no-cache

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/images/*
  Cache-Control: public, max-age=31536000

/favicon.ico
  Cache-Control: public, max-age=86400
`.trim();

  fs.writeFileSync('out/_headers', headersContent);
  console.log('✅ _headers 文件创建完成\n');
}

function createCloudflareRedirects() {
  console.log('📝 创建 Cloudflare 重定向配置...');
  
  const redirectsContent = `
# SPA 路由重定向
/*    /index.html   200

# API 路由保持原样
/api/*  /api/:splat  200

# 资产文件保持原样
/_next/*  /_next/:splat  200
/images/*  /images/:splat  200
`.trim();

  fs.writeFileSync('out/_redirects', redirectsContent);
  console.log('✅ _redirects 文件创建完成\n');
}

function optimizeForCloudflare() {
  console.log('⚡ 优化 Cloudflare 部署...');
  
  // 创建必要的配置文件
  createCloudflareHeaders();
  createCloudflareRedirects();
  
  // 检查输出目录
  if (!fs.existsSync('out')) {
    console.error('❌ 构建输出目录 "out" 不存在');
    process.exit(1);
  }
  
  console.log('✅ Cloudflare 优化完成\n');
}

function validateBuild() {
  console.log('🔍 验证构建输出...');
  
  const requiredFiles = [
    'out/index.html',
    'out/_headers',
    'out/_redirects'
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    console.error('❌ 缺少必需的文件:');
    missingFiles.forEach(file => {
      console.error(`   - ${file}`);
    });
    process.exit(1);
  }
  
  // 检查构建大小
  const outDir = 'out';
  const stats = fs.statSync(outDir);
  console.log(`📊 构建输出大小: ${(getDirectorySize(outDir) / 1024 / 1024).toFixed(2)} MB`);
  
  console.log('✅ 构建验证通过\n');
}

function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  function calculateSize(filePath) {
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      const files = fs.readdirSync(filePath);
      files.forEach(file => {
        calculateSize(path.join(filePath, file));
      });
    } else {
      totalSize += stats.size;
    }
  }
  
  calculateSize(dirPath);
  return totalSize;
}

function displayDeploymentInfo() {
  console.log('🚀 部署信息:');
  console.log('   • 平台: Cloudflare Pages');
  console.log('   • 数据库: Cloudflare D1');
  console.log('   • 存储: Cloudflare R2');
  console.log('   • AI Gateway: Cloudflare AI Gateway');
  console.log('   • 认证: Google OAuth (NextAuth.js)');
  console.log('   • 图像生成: Replicate FLUX 模型');
  console.log('   • 文本生成: Google Gemini');
  console.log('');
  console.log('📋 后续步骤:');
  console.log('   1. 上传 out/ 目录到 Cloudflare Pages');
  console.log('   2. 配置环境变量');
  console.log('   3. 设置自定义域名（可选）');
  console.log('   4. 运行迁移和测试');
  console.log('');
}

function main() {
  console.log('🚀 开始 Remove Anything AI Cloudflare 部署流程...\n');
  
  // 检查环境变量
  checkEnvironmentVariables();
  
  // 安装依赖
  runCommand('npm install', '安装依赖');
  
  // 生成 Prisma 客户端
  runCommand('npx prisma generate', '生成 Prisma 客户端');
  
  // 构建应用
  runCommand('npm run build:cloudflare', '构建应用');
  
  // 优化 Cloudflare 部署
  optimizeForCloudflare();
  
  // 验证构建
  validateBuild();
  
  // 显示部署信息
  displayDeploymentInfo();
  
  console.log('🎉 Remove Anything AI 构建完成！');
  console.log('📦 构建输出位于 out/ 目录');
  console.log('🌐 准备部署到 Cloudflare Pages');
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = { main }; 