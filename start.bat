@echo off
title WINDLENS Launcher
cls

echo ===================================================================
echo   WINDLENS: UK Wind Forecast Intelligence Portal
echo   Automated Desktop Startup
echo ===================================================================
echo.

:: Navigate to project root directory
cd /d "%~dp0"

:: Ensure environment files exist
if not exist ".env" (
    echo [INFO] Creating .env from .env.example...
    copy .env.example .env >nul
)
if not exist "backend\.env" (
    copy .env.example backend\.env >nul
)

echo [1/3] Starting FastAPI Backend on port 8000...
start "WINDLENS Backend API (Port 8000)" cmd /c "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

:: Wait 3 seconds for backend server initialization
timeout /t 3 /nobreak >nul

echo [2/3] Starting React Vite Frontend on port 5173...
start "WINDLENS Frontend UI (Port 5173)" cmd /c "cd /d "%~dp0frontend" && npm run dev"

:: Wait 2 seconds for Vite dev server initialization
timeout /t 2 /nobreak >nul

echo [3/3] Opening WINDLENS in your default web browser...
start http://localhost:5173

echo.
echo ===================================================================
echo   WINDLENS is now running!
echo   - Frontend: http://localhost:5173
echo   - Backend API Docs: http://localhost:8000/docs
echo.
echo   To stop all services, run stop.bat or close the opened windows.
echo ===================================================================
echo.
pause
