@echo off
setlocal
title BOSSMASTER Super Admin Recovery
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RESET_SUPER_ADMIN_PASSWORD.ps1"
endlocal
