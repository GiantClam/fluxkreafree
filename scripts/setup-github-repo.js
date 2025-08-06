#!/usr/bin/env node

/**
 * GitHub 仓库设置脚本
 * 帮助用户创建新的 GitHub 仓库并推送代码
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎨 Remove Anything GitHub 仓库设置向导\n');

// 检查是否已安装 GitHub CLI
function checkGitHubCLI() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// 创建新的 GitHub 仓库
function createGitHubRepo() {
  console.log('📋 创建 GitHub 仓库...');
  
  if (!checkGitHubCLI()) {
    console.log('❌ 未安装 GitHub CLI。请先安装：');
    console.log('   Windows: winget install GitHub.cli');
    console.log('   macOS: brew install gh');
    console.log('   Linux: sudo apt install gh');
    return false;
  }

  try {
    // 检查是否已登录
    execSync('gh auth status', { stdio: 'ignore' });
  } catch (error) {
    console.log('🔐 请先登录 GitHub CLI：');
    console.log('   gh auth login');
    return false;
  }

  const repoName = 'remove-anything';
  const description = '🎨 Remove Anything - AI 背景去除工具，基于 Next.js 和 Cloudflare Workers';
  
  console.log(`📦 创建仓库: ${repoName}`);
  console.log(`📝 描述: ${description}`);
  
  try {
    execSync(`gh repo create ${repoName} --public --description "${description}" --source=. --remote=origin-new --push`, {
      stdio: 'inherit'
    });
    
    console.log('✅ GitHub 仓库创建成功！');
    return true;
  } catch (error) {
    console.log('❌ 创建仓库失败，请手动创建：');
    console.log('   1. 访问 https://github.com/new');
    console.log('   2. 仓库名称: remove-anything');
    console.log('   3. 描述: 🎨 Remove Anything - AI 背景去除工具');
    console.log('   4. 选择 Public');
    console.log('   5. 不要初始化 README、.gitignore 或 License');
    return false;
  }
}

// 更新远程仓库配置
function updateRemoteConfig() {
  console.log('\n🔧 更新远程仓库配置...');
  
  try {
    // 移除旧的远程仓库
    execSync('git remote remove origin', { stdio: 'ignore' });
    
    // 添加新的远程仓库
    const username = execSync('gh api user --jq .login', { encoding: 'utf8' }).trim();
    const newOrigin = `https://github.com/${username}/remove-anything.git`;
    
    execSync(`git remote add origin ${newOrigin}`);
    console.log(`✅ 远程仓库已更新: ${newOrigin}`);
    
    // 推送代码
    console.log('\n📤 推送代码到 GitHub...');
    execSync('git push -u origin main', { stdio: 'inherit' });
    
    console.log('\n🎉 代码已成功推送到 GitHub！');
    console.log(`🌐 访问: https://github.com/${username}/remove-anything`);
    
    return true;
  } catch (error) {
    console.log('❌ 更新远程配置失败');
    console.log('请手动执行以下命令：');
    console.log('   git remote remove origin');
    console.log('   git remote add origin https://github.com/YOUR_USERNAME/remove-anything.git');
    console.log('   git push -u origin main');
    return false;
  }
}

// 创建 GitHub Actions 工作流
function createGitHubActions() {
  console.log('\n🔄 创建 GitHub Actions 工作流...');
  
  const workflowsDir = '.github/workflows';
  const deployWorkflow = path.join(workflowsDir, 'deploy.yml');
  
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }
  
  const workflowContent = `name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
`;
  
  fs.writeFileSync(deployWorkflow, workflowContent);
  console.log('✅ GitHub Actions 工作流已创建');
  
  console.log('\n📝 请在 GitHub 仓库设置中添加以下 Secrets：');
  console.log('   CLOUDFLARE_API_TOKEN: 你的 Cloudflare API Token');
  console.log('   CLOUDFLARE_ACCOUNT_ID: 你的 Cloudflare Account ID');
}

// 主函数
function main() {
  console.log('🎯 开始设置 GitHub 仓库...\n');
  
  // 检查 Git 状态
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      console.log('⚠️  检测到未提交的更改，请先提交所有更改');
      console.log('   git add . && git commit -m "your message"');
      return;
    }
  } catch (error) {
    console.log('❌ 不是 Git 仓库，请先初始化：');
    console.log('   git init && git add . && git commit -m "Initial commit"');
    return;
  }
  
  // 创建 GitHub 仓库
  if (createGitHubRepo()) {
    // 更新远程配置
    updateRemoteConfig();
    
    // 创建 GitHub Actions
    createGitHubActions();
    
    console.log('\n🎉 设置完成！');
    console.log('\n📚 下一步：');
    console.log('   1. 配置环境变量 (.env.local)');
    console.log('   2. 设置 Cloudflare 服务');
    console.log('   3. 部署到 Cloudflare Workers');
    console.log('   4. 查看 DEPLOYMENT_GUIDE.md 获取详细说明');
  } else {
    console.log('\n📝 请手动完成以下步骤：');
    console.log('   1. 在 GitHub 上创建新仓库');
    console.log('   2. 更新远程仓库配置');
    console.log('   3. 推送代码');
    console.log('   4. 配置 GitHub Actions');
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { main }; 