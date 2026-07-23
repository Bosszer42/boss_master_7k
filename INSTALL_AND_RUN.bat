@echo off
setlocal
cd /d "%~dp0"
echo ==============================================
echo BOSSMASTER AI CHAT ^& BATCH - Install and Run
echo ==============================================
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js LTS was not found.
  echo Install Node.js LTS and run this file again.
  pause
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found.
  echo Reinstall Node.js LTS with npm enabled.
  pause
  exit /b 1
)
call npm.cmd install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)
call npm.cmd test
if errorlevel 1 (
  echo [ERROR] Source syntax test failed.
  pause
  exit /b 1
)
call npm.cmd start
