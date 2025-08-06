@echo off
echo 🚀 FluxKreaFree - GitHub推送脚本
echo ================================
echo.
echo ⚠️  请先在GitHub上创建仓库: https://github.com/new
echo    Repository name: fluxkreafree
echo    Description: FluxKreaFree - Free AI Image Generator powered by Flux Krea
echo    设置为Public，不要添加README、.gitignore或License
echo.
set /p USERNAME="请输入您的GitHub用户名: "
echo.
echo 📤 正在配置远程仓库...
git remote add origin https://github.com/%USERNAME%/fluxkreafree.git
git branch -M main
echo.
echo 🔄 正在推送代码到GitHub...
git push -u origin main
echo.
echo ✅ 完成！您的项目现在已在GitHub上：
echo    https://github.com/%USERNAME%/fluxkreafree
echo.
pause