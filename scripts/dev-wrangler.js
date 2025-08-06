#!/usr/bin/env node
/**
 * Next.js + Wrangler 开发脚本
 * 
 * 此脚本执行以下操作：
 * 1. 构建Next.js应用（生成.next目录）
 * 2. 启动wrangler开发服务器
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜色函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function heading(message) {
  log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
}

// 检查.next目录是否存在
function checkNextOutput() {
  const nextDir = path.join(process.cwd(), '.next');
  const standalonePath = path.join(nextDir, 'standalone');
  
  if (!fs.existsSync(nextDir)) {
    return false;
  }
  
  if (!fs.existsSync(standalonePath)) {
    return false;
  }
  
  return true;
}

// 构建Next.js应用
async function buildNextApp() {
  heading('构建 Next.js 应用');
  
  return new Promise((resolve, reject) => {
    log('执行: npm run build');
    
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      shell: true,
    });
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        success('Next.js 应用构建完成');
        resolve();
      } else {
        error(`构建失败，退出代码: ${code}`);
        reject(new Error(`Build failed with code ${code}`));
      }
    });
  });
}

// 启动Wrangler开发服务器
function startWranglerDev() {
  heading('启动 Wrangler 开发服务器');
  
  const wranglerArgs = [
    'dev',
    '--local', // 使用本地模式
    '--persist-to', './.wrangler/state', // 持久化状态
    '--experimental-local', // 启用本地模式的实验性功能
    '--node-compat', // Node.js兼容模式
    '--ip', 'localhost'
  ];
  
  log(`执行: wrangler ${wranglerArgs.join(' ')}`);
  
  const wranglerProcess = spawn('wrangler', wranglerArgs, {
    stdio: 'inherit',
    shell: true,
  });
  
  wranglerProcess.on('close', (code) => {
    if (code !== 0) {
      error(`Wrangler 开发服务器已退出，退出代码: ${code}`);
    }
  });
}

// 主函数
async function main() {
  try {
    heading('Next.js + Wrangler 开发服务器');
    
    // 检查是否已构建
    if (!checkNextOutput()) {
      log('未检测到 Next.js 构建输出，开始构建...', colors.yellow);
      await buildNextApp();
    } else {
      log('检测到现有的 Next.js 构建输出', colors.green);
      log('如需重新构建，请运行: npm run build', colors.yellow);
    }
    
    // 启动Wrangler开发服务器
    startWranglerDev();
  } catch (err) {
    error(`发生错误: ${err.message}`);
    process.exit(1);
  }
}

// 执行主函数
main(); 