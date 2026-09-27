@echo off
title AeroPulse India - GitHub Repository Push Helper
echo =====================================================================
echo         AeroPulse India - GitHub + Vercel Deployment Setup
echo =====================================================================
echo.

where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Git is not installed or not in your PATH.
    echo     Installing Git via Windows Package Manager ^(winget^)...
    winget install --id Git.Git -e --source winget
    echo.
    echo [!] Please close and reopen this script after Git finishes installing.
    pause
    exit /b 1
)

if not exist ".git" (
    echo [*] Initializing Git repository...
    git init
    git branch -M main
)

echo [*] Staging project files...
git add .
git commit -m "Initial commit: AeroPulse India platform ready for Vercel"

echo.
set /p REPO_URL="Paste your GitHub Repository URL (e.g. https://github.com/username/aeropulse.git): "
if "%REPO_URL%"=="" (
    echo [!] No repository URL entered. Exiting.
    pause
    exit /b 1
)

git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%
echo [*] Pushing to GitHub (main branch)...
git push -u origin main

echo.
echo =====================================================================
echo [SUCCESS] Code pushed to GitHub!
echo Next Step: Go to https://vercel.com/new and import your repository.
echo =====================================================================
pause
