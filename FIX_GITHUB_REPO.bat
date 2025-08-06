@echo off
echo 🔧 FluxKreaFree - GitHub仓库修复脚本
echo ====================================
echo.
echo 📋 当前状态检查:
echo    远程仓库: %(git remote get-url origin)
echo.
echo ⚠️  问题诊断:
echo    当前连接到 remove-anything 仓库，需要连接到 fluxkreafree 仓库
echo.
echo 📝 解决步骤:
echo    1. 请在GitHub上创建新的 fluxkreafree 仓库
echo    2. 然后输入您的GitHub用户名
echo.
set /p USERNAME="请输入您的GitHub用户名: "
echo.
echo 🔄 正在更新远程仓库URL...
git remote set-url origin https://github.com/%USERNAME%/fluxkreafree.git
echo.
echo ✅ 远程仓库已更新为: https://github.com/%USERNAME%/fluxkreafree.git
echo.
echo 📤 正在推送代码到新仓库...
git push -u origin main
echo.
echo 🎉 完成！现在您可以在以下地址查看代码：
echo    https://github.com/%USERNAME%/fluxkreafree
echo.
pause 