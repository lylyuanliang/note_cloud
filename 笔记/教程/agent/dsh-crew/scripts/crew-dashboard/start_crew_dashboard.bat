@echo off
rem ============================================================
rem  DSH Crew dashboard launcher
rem  - already running?  -> just open Chrome
rem  - not running?      -> start it (hidden), wait, open Chrome
rem ============================================================
setlocal EnableExtensions
set "PORT=3940"
set "URL=http://127.0.0.1:%PORT%/"
set "SERVER=%~dp0server.mjs"
set "NODE=D:\soft\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"

rem ---- 1) health check: is our dashboard already up? ----
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/health' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}}catch{}; exit 1" >nul 2>&1
if %errorlevel%==0 (
  echo [dsh-crew] already running - opening browser...
  goto :open
)

rem ---- 2) not running: start it detached (no window) ----
echo [dsh-crew] starting dashboard on port %PORT% ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%NODE%' -ArgumentList '%SERVER%' -WindowStyle Hidden"

rem ---- 3) wait until the port answers (max 15s) ----
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Date).AddSeconds(15); while((Get-Date) -lt $d){ try{$r=Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/health' -UseBasicParsing -TimeoutSec 1; if($r.StatusCode -eq 200){exit 0}}catch{}; Start-Sleep -Milliseconds 400 }; exit 1" >nul 2>&1
if errorlevel 1 (
  echo [dsh-crew] FAILED to start. Check node path: %NODE%
  echo [dsh-crew] server file: %SERVER%
  pause
  exit /b 1
)
echo [dsh-crew] dashboard is up.

:open
if exist "%CHROME%" (
  start "" "%CHROME%" "%URL%"
) else (
  start "" "%URL%"
)
endlocal
