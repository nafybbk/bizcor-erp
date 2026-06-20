@echo off
echo ╔══════════════════════════════════════════════════╗
echo ║   BizCor Report Designer — EXE Build Script     ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: Step 1: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js install nahi hai! https://nodejs.org se install karo.
    pause
    exit /b 1
)

:: Step 2: Check pnpm
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] pnpm install kar raha hoon...
    npm install -g pnpm
)

echo [1/4] report-designer dependencies install kar raha hoon...
cd /d "%~dp0..\report-designer"
pnpm install
if %errorlevel% neq 0 ( echo [ERROR] Dependencies failed! & pause & exit /b 1 )

echo.
echo [2/4] Frontend build kar raha hoon (Electron mode)...
pnpm exec vite build --config vite.electron.config.ts
if %errorlevel% neq 0 ( echo [ERROR] Vite build failed! & pause & exit /b 1 )

echo.
echo [3/4] Electron dependencies install kar raha hoon...
cd /d "%~dp0"
npm install
if %errorlevel% neq 0 ( echo [ERROR] Electron deps failed! & pause & exit /b 1 )

echo.
echo [4/4] EXE bana raha hoon...
npm run build:win
if %errorlevel% neq 0 ( echo [ERROR] EXE build failed! & pause & exit /b 1 )

echo.
echo ✅ BUILD COMPLETE!
echo.
echo EXE yahan milegi: release\
dir /b release\*.exe 2>nul
dir /b release\win-unpacked\*.exe 2>nul
echo.
pause
