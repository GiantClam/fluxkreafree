#!/bin/bash

echo "🚀 开始Vercel构建..."

# 初始化并更新 Git submodules
echo "📦 初始化 Git submodules..."
git submodule update --init --recursive

# 检查 submodules 是否初始化成功
if [ -d "modules/runninghub" ]; then
    echo "✅ Git submodules 初始化成功"
else
    echo "⚠️ 警告: Git submodules 可能未正确初始化"
fi

# 确保Prisma Client是最新的
echo "📦 生成Prisma Client..."
npx prisma generate

# 检查生成是否成功
if [ $? -eq 0 ]; then
    echo "✅ Prisma Client生成成功"
else
    echo "❌ Prisma Client生成失败"
    exit 1
fi

# 运行Next.js构建
echo "🏗️ 开始Next.js构建..."
npm run build

# 检查构建是否成功
if [ $? -eq 0 ]; then
    echo "✅ 构建成功完成"
else
    echo "❌ 构建失败"
    exit 1
fi

echo "🎉 Vercel构建完成！" 