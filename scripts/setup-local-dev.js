#!/usr/bin/env node
/**
 * Cloudflare服务本地开发设置脚本
 * 
 * 这个脚本会：
 * 1. 检查是否安装了wrangler
 * 2. 创建本地KV命名空间
 * 3. 创建本地R2存储桶
 * 4. 更新wrangler.toml配置
 * 5. 生成用于本地开发的.env.local文件
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 颜色函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  console.error(`${colors.red}错误: ${message}${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function warn(message) {
  console.log(`${colors.yellow}! ${message}${colors.reset}`);
}

function heading(message) {
  console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
}

// 检查是否安装了wrangler
function checkWrangler() {
  heading('检查 wrangler 安装');
  try {
    const version = execSync('wrangler --version', { stdio: 'pipe' }).toString().trim();
    success(`已安装 wrangler: ${version}`);
    return true;
  } catch (err) {
    error('未安装 wrangler，请先使用以下命令安装:');
    log('npm install -g wrangler');
    return false;
  }
}

// 检查是否已登录到Cloudflare
function checkCloudflareLogin() {
  heading('检查 Cloudflare 登录状态');
  try {
    const whoami = execSync('wrangler whoami', { stdio: 'pipe' }).toString().trim();
    if (whoami.includes('You are not logged in')) {
      error('未登录到 Cloudflare，请先使用以下命令登录:');
      log('wrangler login');
      return false;
    }
    
    // 提取账户信息
    const accountMatch = whoami.match(/Account ID: ([a-f0-9]+)/);
    const accountName = whoami.match(/Account Name: (.+)/);
    
    if (accountMatch && accountMatch[1]) {
      const accountId = accountMatch[1];
      success(`已登录到 Cloudflare，账户ID: ${accountId}`);
      if (accountName && accountName[1]) {
        log(`账户名称: ${accountName[1]}`);
      }
      return accountId;
    }
    
    warn('已登录到 Cloudflare，但无法获取账户ID');
    return true;
  } catch (err) {
    error('检查登录状态时出错:');
    console.error(err);
    return false;
  }
}

// 创建KV命名空间
async function createKVNamespace() {
  heading('创建 KV 命名空间');
  
  return new Promise((resolve) => {
    rl.question('请输入KV命名空间名称 [next-money-kv]: ', (name) => {
      const namespaceName = name || 'next-money-kv';
      
      try {
        log(`正在创建KV命名空间: ${namespaceName}...`);
        const output = execSync(`wrangler kv:namespace create "${namespaceName}"`, { stdio: 'pipe' }).toString();
        
        // 提取命名空间ID
        const idMatch = output.match(/id = "([a-f0-9]+)"/);
        if (idMatch && idMatch[1]) {
          const namespaceId = idMatch[1];
          success(`KV命名空间已创建，ID: ${namespaceId}`);
          
          // 创建预览命名空间
          log(`正在创建预览KV命名空间: ${namespaceName}-preview...`);
          const previewOutput = execSync(`wrangler kv:namespace create "${namespaceName}-preview" --preview`, { stdio: 'pipe' }).toString();
          const previewIdMatch = previewOutput.match(/preview_id = "([a-f0-9]+)"/);
          
          if (previewIdMatch && previewIdMatch[1]) {
            const previewId = previewIdMatch[1];
            success(`预览KV命名空间已创建，ID: ${previewId}`);
            resolve({ namespaceId, previewId, name: namespaceName });
            return;
          }
        }
        
        warn('无法从输出中提取命名空间ID，请手动检查:');
        log(output);
        resolve({ error: true });
      } catch (err) {
        error('创建KV命名空间时出错:');
        console.error(err.toString());
        resolve({ error: true });
      }
    });
  });
}

// 创建R2存储桶
async function createR2Bucket() {
  heading('创建 R2 存储桶');
  
  return new Promise((resolve) => {
    rl.question('请输入R2存储桶名称 [next-money-storage]: ', (name) => {
      const bucketName = name || 'next-money-storage';
      
      try {
        log(`正在创建R2存储桶: ${bucketName}...`);
        execSync(`wrangler r2 bucket create ${bucketName}`, { stdio: 'pipe' });
        success(`R2存储桶已创建: ${bucketName}`);
        
        // 创建预览存储桶
        log(`正在创建预览R2存储桶: ${bucketName}-preview...`);
        execSync(`wrangler r2 bucket create ${bucketName}-preview`, { stdio: 'pipe' });
        success(`预览R2存储桶已创建: ${bucketName}-preview`);
        
        resolve({ bucketName, previewBucketName: `${bucketName}-preview` });
      } catch (err) {
        error('创建R2存储桶时出错:');
        console.error(err.toString());
        resolve({ error: true });
      }
    });
  });
}

// 更新wrangler.toml配置
function updateWranglerConfig(kvNamespace, r2Bucket, accountId) {
  heading('更新 wrangler.toml 配置');
  
  try {
    const wranglerPath = path.join(process.cwd(), 'wrangler.toml');
    let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    
    // 替换KV配置
    wranglerContent = wranglerContent.replace(
      /\[\[kv_namespaces\]\]\s*binding\s*=\s*"KV"\s*preview_id\s*=\s*"([^"]*)"\s*id\s*=\s*"([^"]*)"/,
      `[[kv_namespaces]]\nbinding = "KV"\npreview_id = "${kvNamespace.previewId}"\nid = "${kvNamespace.namespaceId}"`
    );
    
    // 替换R2配置
    wranglerContent = wranglerContent.replace(
      /\[\[r2_buckets\]\]\s*binding\s*=\s*"R2"\s*bucket_name\s*=\s*"([^"]*)"\s*preview_bucket_name\s*=\s*"([^"]*)"/,
      `[[r2_buckets]]\nbinding = "R2"\nbucket_name = "${r2Bucket.bucketName}"\npreview_bucket_name = "${r2Bucket.previewBucketName}"`
    );
    
    // 更新环境特定配置
    // 开发环境
    wranglerContent = wranglerContent.replace(
      /\[\[env\.development\.kv_namespaces\]\]\s*binding\s*=\s*"KV"\s*id\s*=\s*"([^"]*)"/,
      `[[env.development.kv_namespaces]]\nbinding = "KV"\nid = "${kvNamespace.previewId}"`
    );
    
    wranglerContent = wranglerContent.replace(
      /\[\[env\.development\.r2_buckets\]\]\s*binding\s*=\s*"R2"\s*bucket_name\s*=\s*"([^"]*)"/,
      `[[env.development.r2_buckets]]\nbinding = "R2"\nbucket_name = "${r2Bucket.previewBucketName}"`
    );
    
    // 暂存环境
    wranglerContent = wranglerContent.replace(
      /\[\[env\.staging\.kv_namespaces\]\]\s*binding\s*=\s*"KV"\s*id\s*=\s*"([^"]*)"/,
      `[[env.staging.kv_namespaces]]\nbinding = "KV"\nid = "${kvNamespace.previewId}"`
    );
    
    wranglerContent = wranglerContent.replace(
      /\[\[env\.staging\.r2_buckets\]\]\s*binding\s*=\s*"R2"\s*bucket_name\s*=\s*"([^"]*)"/,
      `[[env.staging.r2_buckets]]\nbinding = "R2"\nbucket_name = "${r2Bucket.previewBucketName}"`
    );
    
    fs.writeFileSync(wranglerPath, wranglerContent);
    success('wrangler.toml 已更新');
    
    return true;
  } catch (err) {
    error('更新wrangler.toml时出错:');
    console.error(err);
    return false;
  }
}

// 生成.env.local文件
function generateEnvFile(kvNamespace, accountId) {
  heading('生成 .env.local 文件');
  
  try {
    const envTemplatePath = path.join(process.cwd(), 'env.template');
    let envContent = fs.readFileSync(envTemplatePath, 'utf8');
    
    // 从模板中读取，替换需要的值
    envContent = envContent.replace('CLOUDFLARE_KV_NAMESPACE_ID=', `CLOUDFLARE_KV_NAMESPACE_ID=${kvNamespace.namespaceId}`);
    envContent = envContent.replace('CLOUDFLARE_KV_ACCOUNT_ID=', `CLOUDFLARE_KV_ACCOUNT_ID=${accountId}`);
    
    // 创建API Token提示
    envContent = envContent.replace('CLOUDFLARE_KV_API_TOKEN=', 'CLOUDFLARE_KV_API_TOKEN=请在Cloudflare Dashboard创建并填写API Token');
    
    const envLocalPath = path.join(process.cwd(), '.env.local');
    fs.writeFileSync(envLocalPath, envContent);
    success('.env.local 文件已生成');
    
    // 添加提示信息
    log('\n要完成设置，请执行以下操作:', colors.yellow);
    log('1. 在Cloudflare Dashboard (https://dash.cloudflare.com) 创建API Token');
    log('2. 给Token添加以下权限:');
    log('   - Account > Cloudflare Workers > Edit');
    log('   - Account > Account Settings > Read');
    log('   - Zone > Zone Settings > Read');
    log('3. 编辑 .env.local 文件，填写 CLOUDFLARE_KV_API_TOKEN');
    log('4. 运行 `npm run dev` 启动开发服务器');
    
    return true;
  } catch (err) {
    error('生成.env.local文件时出错:');
    console.error(err);
    return false;
  }
}

// 主函数
async function main() {
  log('🚀 开始设置 Cloudflare 本地开发环境', colors.cyan);
  
  // 检查wrangler
  if (!checkWrangler()) {
    process.exit(1);
  }
  
  // 检查是否登录
  const accountId = await checkCloudflareLogin();
  if (!accountId) {
    process.exit(1);
  }
  
  // 创建KV命名空间
  const kvNamespace = await createKVNamespace();
  if (kvNamespace.error) {
    process.exit(1);
  }
  
  // 创建R2存储桶
  const r2Bucket = await createR2Bucket();
  if (r2Bucket.error) {
    process.exit(1);
  }
  
  // 更新wrangler.toml
  updateWranglerConfig(kvNamespace, r2Bucket, accountId);
  
  // 生成.env.local
  generateEnvFile(kvNamespace, accountId);
  
  log('\n🎉 设置完成!', colors.green);
  log('现在你可以使用 `wrangler dev` 运行本地开发服务器，或 `npm run dev` 运行Next.js开发服务器');
  
  rl.close();
}

main().catch((err) => {
  error('设置过程中出错:');
  console.error(err);
  process.exit(1);
}); 