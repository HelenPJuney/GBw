@echo off
title Stop WINDLENS
cls

echo ===================================================================
echo   Stopping WINDLENS Services...
echo ===================================================================
echo.

echo Stopping FastAPI backend (Python / Uvicorn on port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Stopping Vite frontend (Node on port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo All WINDLENS services have been stopped.
echo ===================================================================
echo.
timeout /t 2 >nul
