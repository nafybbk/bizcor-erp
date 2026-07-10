@echo off
title BizCor ERP - Auto Updater
echo.
echo  ============================================
echo   BizCor ERP - Latest Version Download
echo  ============================================
echo.
echo  GitHub se latest version check ho raha hai...
echo.

set "REPO=nafybbk/bizcor-releases"
set "API_URL=https://api.github.com/repos/%REPO%/releases/latest"
set "TEMP_JSON=%TEMP%\bizcor_release.json"
set "DOWNLOAD_DIR=%USERPROFILE%\Downloads"

curl -s -L "%API_URL%" -o "%TEMP_JSON%"
if errorlevel 1 (
    echo  [ERROR] Internet connection nahi hai ya GitHub reachable nahi.
    pause
    exit /b 1
)

for /f "tokens=2 delims=:, " %%a in ('findstr /i "tag_name" "%TEMP_JSON%"') do (
    set "VERSION=%%~a"
    goto :found_version
)
:found_version
set "VERSION=%VERSION:"=%"
set "VERSION=%VERSION: =%"

if "%VERSION%"=="" (
    echo  [ERROR] Version detect nahi hua.
    pause
    exit /b 1
)

echo  Latest version: %VERSION%
echo.

set "VERSION_NUM=%VERSION:v=%"
set "EXE_NAME=BizCor-ERP-Setup-%VERSION_NUM%.exe"
set "DOWNLOAD_URL=https://github.com/%REPO%/releases/download/%VERSION%/%EXE_NAME%"
set "SAVE_PATH=%DOWNLOAD_DIR%\%EXE_NAME%"

if exist "%SAVE_PATH%" (
    echo  File pehle se download hai: %SAVE_PATH%
    echo.
    choice /c YN /m " Dobara download karein"
    if errorlevel 2 goto :install
)

echo  Download ho raha hai: %EXE_NAME%
echo  Yeh 2-3 minute le sakta hai...
echo.

curl -L --progress-bar "%DOWNLOAD_URL%" -o "%SAVE_PATH%"

if errorlevel 1 (
    echo.
    echo  [ERROR] Download fail hua. Internet check karein.
    del "%SAVE_PATH%" 2>nul
    pause
    exit /b 1
)

echo.
echo  Download complete!

:install
echo.
echo  Install ho raha hai... (BizCor ERP band kar lein pehle)
echo.
start "" "%SAVE_PATH%"
echo.
echo  Installer open ho gaya. Install karein aur enjoy karein!
echo.
del "%TEMP_JSON%" 2>nul
pause
