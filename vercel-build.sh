#!/bin/bash

set -e  # 遇到错误立即退出

echo "🚀 开始Vercel构建..."

# 初始化并更新 Git submodules
echo "📦 初始化 Git submodules..."
if [ -f ".gitmodules" ]; then
    # 强制更新到最新的 submodule 提交
    echo "🔄 更新 submodules 到最新版本..."
    git submodule update --init --recursive --remote || {
        echo "⚠️ 使用 --remote 失败，尝试标准更新..."
        git submodule update --init --recursive || {
            echo "⚠️ 警告: Git submodules 初始化失败，继续构建..."
        }
    }
    
    # 显示当前 submodule 的提交信息
    echo "📋 当前 submodule 状态:"
    git submodule status || true
else
    echo "ℹ️ 未找到 .gitmodules 文件，跳过 submodule 初始化"
fi

# 检查 submodules 是否初始化成功
if [ -d "modules/runninghub" ] || [ -d "modules/tasks" ]; then
    echo "✅ Git submodules 初始化成功"
    echo "📋 检查 modules 目录内容..."
    ls -la modules/ || true
else
    echo "⚠️ 警告: Git submodules 可能未正确初始化，但继续构建..."
fi

# 确保Prisma Client是最新的
echo "📦 生成Prisma Client..."
npx prisma generate || {
    echo "❌ Prisma Client生成失败"
    exit 1
}
echo "✅ Prisma Client生成成功"

# 验证 TypeScript 配置
echo "🔍 验证 TypeScript 配置..."
if [ -f "tsconfig.json" ]; then
    echo "✅ 找到 tsconfig.json"
    # 检查 modules 目录是否在 include 中
    if grep -q "modules" tsconfig.json; then
        echo "✅ modules 目录已在 tsconfig.json 中配置"
    fi
else
    echo "⚠️ 警告: 未找到 tsconfig.json"
fi

# 运行Next.js构建
echo "🏗️ 开始Next.js构建..."
npm run build || {
    echo "❌ 构建失败"
    echo "📋 构建日志："
    exit 1
}

echo "✅ 构建成功完成"
echo "🎉 Vercel构建完成！" 