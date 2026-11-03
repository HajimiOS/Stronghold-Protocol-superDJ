@echo off
setlocal EnableExtensions
chcp 65001 >nul
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0install-windows.ps1" -Mode uninstall
echo.
pause
exit /b %ERRORLEVEL%
