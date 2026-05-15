# Browser Extension Package Script (PowerShell)
# Creates distribution packages for Chrome and Firefox

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $SCRIPT_DIR

Write-Host "📦 开始打包浏览器扩展..." -ForegroundColor Cyan

# Clean previous builds
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
New-Item -ItemType Directory -Path "dist" -Force | Out-Null

# Package for Chrome/Edge/Brave (Chromium-based)
Write-Host ""
Write-Host "🌐 打包 Chrome/Edge/Brave 版本..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "dist/chromium" -Force | Out-Null
Copy-Item "manifest.json" "dist/chromium/"
Copy-Item "popup.html", "popup.js" "dist/chromium/"
Copy-Item "options.html", "options.js" "dist/chromium/"
Copy-Item "background.js" "dist/chromium/"
Copy-Item "styles.css" "dist/chromium/"
Copy-Item -Recurse "icons" "dist/chromium/"

# Create zip using .NET compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = Join-Path $SCRIPT_DIR "dist/bookmark-manager-chromium.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }
[System.IO.Compression.ZipFile]::CreateFromDirectory("dist/chromium", $zipPath)
Write-Host "✅ Chromium 版本打包完成: dist/bookmark-manager-chromium.zip" -ForegroundColor Green

# Package for Firefox
Write-Host ""
Write-Host "🦊 打包 Firefox 版本..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "dist/firefox" -Force | Out-Null
Copy-Item "manifest.firefox.json" "dist/firefox/manifest.json"
Copy-Item "popup.html", "popup.js" "dist/firefox/"
Copy-Item "options.html", "options.js" "dist/firefox/"
Copy-Item "background.firefox.js" "dist/firefox/background.js"
Copy-Item "styles.css" "dist/firefox/"
Copy-Item -Recurse "icons" "dist/firefox/"

$zipPath = Join-Path $SCRIPT_DIR "dist/bookmark-manager-firefox.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }
[System.IO.Compression.ZipFile]::CreateFromDirectory("dist/firefox", $zipPath)
Write-Host "✅ Firefox 版本打包完成: dist/bookmark-manager-firefox.zip" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 打包完成！输出目录: dist/" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 生成的文件：" -ForegroundColor Cyan
Get-ChildItem "dist/*.zip" | ForEach-Object { Write-Host "  $($_.Name) ($( '{0:N0}' -f $_.Length ) bytes)" }
Write-Host ""
Write-Host "安装说明：" -ForegroundColor Cyan
Write-Host "  - Chrome/Edge/Brave: 使用 bookmark-manager-chromium.zip"
Write-Host "  - Firefox: 使用 bookmark-manager-firefox.zip"