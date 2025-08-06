#!/usr/bin/env node
/**
 * 增强版 Wrangler 开发脚本
 * 
 * 这个脚本提供了更好的 Next.js + Wrangler 集成体验:
 * 1. 检查 Next.js 构建输出
 * 2. 如需要，执行构建
 * 3. 优化 wrangler.toml 配置
 * 4. 启动 Wrangler 开发服务器
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
  magenta: '\x1b[35m',
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

function warning(message) {
  log(`⚠️ ${message}`, colors.yellow);
}

function heading(message) {
  log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
}

function info(message) {
  log(`ℹ️ ${message}`, colors.blue);
}

// 检查wrangler是否安装
function checkWrangler() {
  try {
    execSync('wrangler --version', { stdio: 'ignore' });
    return true;
  } catch (err) {
    error('未检测到 wrangler 命令，请先安装:');
    log('npm install -g wrangler');
    return false;
  }
}

// 检查Next.js构建输出
function checkNextOutput() {
  const nextDir = path.join(process.cwd(), '.next');
  
  if (!fs.existsSync(nextDir)) {
    warning('未检测到 .next 目录');
    return false;
  }
  
  const serverFile = path.join(nextDir, 'server.js');
  if (!fs.existsSync(serverFile)) {
    const standaloneServerFile = path.join(nextDir, 'standalone', 'server.js');
    if (fs.existsSync(standaloneServerFile)) {
      info('检测到 standalone 模式的 server.js');
      // 复制 standalone/server.js 到 .next/server.js 以适应 wrangler 配置
      try {
        fs.copyFileSync(standaloneServerFile, serverFile);
        success('已复制 server.js 到 .next 目录根');
      } catch (err) {
        error(`复制 server.js 失败: ${err.message}`);
        return false;
      }
    } else {
      warning('未检测到 server.js 文件');
      return false;
    }
  }
  
  success('Next.js 构建输出检查通过');
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

// 确保 .wrangler 目录存在
function ensureWranglerDir() {
  const wranglerDir = path.join(process.cwd(), '.wrangler');
  const stateDir = path.join(wranglerDir, 'state');
  
  if (!fs.existsSync(wranglerDir)) {
    fs.mkdirSync(wranglerDir);
  }
  
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir);
  }
}

// 启动Wrangler开发服务器
function startWranglerDev() {
  heading('启动 Wrangler 开发服务器');
  
  const wranglerArgs = [
    'dev',
    '--local',
    '--persist-to', './.wrangler/state',
    '--ip', 'localhost',
  ];
  
  // 检查是否有自定义端口设置
  const customPort = process.env.PORT || 3000;
  wranglerArgs.push('--port', customPort.toString());
  
  // Node.js 兼容性已在 wrangler.toml 中配置
  // compatibility_flags = ["nodejs_compat"] 提供了更好的 Node.js 支持
  info('使用 wrangler.toml 中配置的 nodejs_compat 兼容性标志');
  
  log(`执行: wrangler ${wranglerArgs.join(' ')}`);
  
  const wranglerProcess = spawn('wrangler', wranglerArgs, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });
  
  wranglerProcess.on('error', (err) => {
    error(`启动Wrangler失败: ${err.message}`);
  });
  
  wranglerProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      error(`Wrangler 开发服务器已退出，退出代码: ${code}`);
    }
  });
}

// 主函数
async function main() {
  try {
    heading('Next.js + Wrangler 开发服务器');
    
    // 显示帮助信息
    log('这个脚本会启动 Wrangler 开发服务器，以便在本地使用 Cloudflare Workers 环境');
    log('将使用 wrangler.toml 中配置的 KV、R2、D1 等绑定');
    
    // 检查wrangler安装
    if (!checkWrangler()) {
      process.exit(1);
    }
    
    // 检查并准备 .wrangler 目录
    ensureWranglerDir();
    
    // 检查是否已构建
    if (!checkNextOutput()) {
      log('未检测到有效的 Next.js 构建输出，开始构建...', colors.yellow);
      await buildNextApp();
      
      // 再次检查构建输出
      if (!checkNextOutput()) {
        error('构建后仍未检测到有效的 Next.js 输出，请检查 next.config.mjs 配置');
        log('确保已设置 output: "standalone" 选项', colors.yellow);
        process.exit(1);
      }
    } else {
      log('检测到有效的 Next.js 构建输出', colors.green);
      log('如需重新构建，请运行: npm run build', colors.blue);
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