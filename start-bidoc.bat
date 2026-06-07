@echo off
setlocal

cd /d "%~dp0"
title BiDoc Local Server

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  echo Install Node.js 20 or newer and try again.
  pause
  exit /b 1
)

set "APP_URL=http://localhost:4000/"

echo Starting BiDoc local server...
start "BiDoc Server" cmd /k "cd /d ""%~dp0"" && node src\server.js"

echo Waiting for the server...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = '%APP_URL%'; for ($i = 0; $i -lt 60; $i++) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if ($response.StatusCode -ge 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"

if errorlevel 1 (
  echo The server did not become available at %APP_URL%.
  echo Check the BiDoc Server window for the error details.
  pause
  exit /b 1
)

start "" "%APP_URL%"
exit /b 0
