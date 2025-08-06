#!/bin/bash

echo "🚀 开始Vercel构建..."

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