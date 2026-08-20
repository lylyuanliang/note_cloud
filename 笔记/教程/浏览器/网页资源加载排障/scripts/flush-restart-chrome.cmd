@echo off
REM 双击启动器: 绕过执行策略运行 ps1
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0flush-restart-chrome.ps1"
