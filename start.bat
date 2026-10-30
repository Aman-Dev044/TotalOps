@echo off
title TotalOps launcher
cd /d "%~dp0"

echo.
echo  ==========================================
echo    TotalOps - Window Tinting CRM
echo  ==========================================
echo.

where node >nul 2>nul || (echo Node.js 20+ is required. Install it from https://nodejs.org & pause & exit /b 1)

if not exist "backend\node_modules" (
  echo Installing backend packages...
  pushd backend & call npm install --no-audit --no-fund & popd
)
if not exist "frontend\node_modules" (
  echo Installing frontend packages...
  pushd frontend & call npm install --no-audit --no-fund & popd
)
if not exist "backend\.env.local" copy "backend\.env.example" "backend\.env.local" >nul
if not exist "frontend\.env.local" copy "frontend\.env.example" "frontend\.env.local" >nul

echo Building backend...
pushd backend & call npm run build || (popd & echo Backend build failed & pause & exit /b 1)
popd
echo Building frontend...
pushd frontend & call npm run build || (popd & echo Frontend build failed & pause & exit /b 1)
popd

start "TotalOps API :4000" cmd /k "cd /d %~dp0backend && npm start"
start "TotalOps Web :3000" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo  Backend  : http://localhost:4000/api/health
echo  Frontend : http://localhost:3000
echo  Login    : admin@totalops.app / Admin@123  (change it in Settings - Account)
echo.
timeout /t 6 >nul
start "" http://localhost:3000
