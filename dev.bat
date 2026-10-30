@echo off
rem Development mode with hot reload (no production build).
cd /d "%~dp0"
if not exist "backend\node_modules" (pushd backend & call npm install & popd)
if not exist "frontend\node_modules" (pushd frontend & call npm install & popd)
if not exist "backend\.env.local" copy "backend\.env.example" "backend\.env.local" >nul
if not exist "frontend\.env.local" copy "frontend\.env.example" "frontend\.env.local" >nul
start "TotalOps API (dev) :4000" cmd /k "cd /d %~dp0backend && npm run dev"
start "TotalOps Web (dev) :3000" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 8 >nul
start "" http://localhost:3000
