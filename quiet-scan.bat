@echo off
REM quiet-scan.bat - Run the Task Master workspace scanner with minimal output
REM 
REM Usage: quiet-scan.bat [directory]
REM 
REM This script runs the workspace scanner with LOG_LEVEL=error to suppress
REM all logs except errors, showing only the progress bar.

REM Default directory is current directory if not specified
set "DIRECTORY=%1"
if "%DIRECTORY%"=="" set "DIRECTORY=."

REM Set LOG_LEVEL environment variable
set LOG_LEVEL=error

REM Run the scanner with the quiet flag and specified directory
npx task-master scan-workspace "%DIRECTORY%" --quiet

REM Exit with the same code as the scanner
exit /b %ERRORLEVEL% 