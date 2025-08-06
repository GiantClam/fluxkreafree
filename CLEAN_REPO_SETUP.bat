@echo off
echo 🧹 FluxKreaFree - 创建干净仓库脚本
echo ====================================
echo.
echo 📋 当前问题:
echo    GitHub检测到历史提交中的敏感信息
echo    需要创建全新的干净仓库
echo.
echo 🔧 解决步骤:
echo    1. 在GitHub上创建新的 fluxkreafree-clean 仓库
echo    2. 输入您的GitHub用户名
echo    3. 脚本将创建干净的代码副本
echo.
set /p USERNAME="请输入您的GitHub用户名: "
echo.
echo 🗂️  正在创建干净的代码副本...
if not exist "clean-fluxkreafree" mkdir clean-fluxkreafree
xcopy /E /I /H /Y . clean-fluxkreafree\
cd clean-fluxkreafree
echo.
echo 🗑️  正在清理敏感文件...
del /Q .env.local 2>nul
del /Q build-output.txt 2>nul
del /Q .git 2>nul
echo.
echo 🔄 正在初始化新的Git仓库...
git init
git add .
git commit -m "🎉 初始提交: FluxKreaFree - 免费AI图像生成器

✨ 主要功能:
- 🎨 基于Flux Krea的photorealistic AI图像生成
- 🌍 支持10种语言的多语言界面
- ⚡ 整合的提示词生成器和指南
- 🔓 完全免费，无限制使用
- 📱 响应式设计，支持所有设备

🚀 技术栈:
- Next.js 14 + TypeScript
- Tailwind CSS + Shadcn/ui
- next-intl国际化
- Prisma数据库
- Flux Krea AI模型

🛡️ 安全:
- 已清理所有敏感信息
- 环境变量已模板化
- 完整的.gitignore配置"
echo.
echo 📤 正在配置远程仓库...
git remote add origin https://github.com/%USERNAME%/fluxkreafree-clean.git
git branch -M main
echo.
echo 🔄 正在推送代码到新仓库...
git push -u origin main
echo.
echo ✅ 完成！您的干净项目现在在：
echo    https://github.com/%USERNAME%/fluxkreafree-clean
echo.
pause 