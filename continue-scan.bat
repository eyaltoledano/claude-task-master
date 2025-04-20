@echo off
REM continue-scan.bat
REM This script continues the workspace scanner process and displays all generated documents

REM Set NODE_OPTIONS to increase memory limit if needed
SET NODE_OPTIONS=--max-old-space-size=4096

REM Get the directory of this script
SET SCRIPT_DIR=%~dp0

REM Run the continue-scan.js script
node "%SCRIPT_DIR%scripts\continue-scan.js" %*

REM Check for successful execution
IF %ERRORLEVEL% EQU 0 (
  echo.
  echo [92m✅ Workspace scan continuation completed successfully![0m
) ELSE (
  echo.
  echo [91m❌ Workspace scan continuation failed![0m
  exit /b 1
) 