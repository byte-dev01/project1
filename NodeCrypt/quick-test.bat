@echo off
echo ========================================
echo  HIPAA Medical Chat - Quick Test Suite
echo ========================================
echo.

echo [1] Running automated tests...
echo.

call node test-runner.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo  ✅ ALL TESTS PASSED
    echo ========================================
    echo.
    echo [2] Opening test report...
    start test-report.html
    echo.
    echo [3] Would you like to start the demo? (y/n)
    set /p demo=
    if /i "%demo%"=="y" (
        echo.
        echo Starting servers...
        start cmd /k "node server/hipaa-server.js"
        timeout /t 2 >nul
        start cmd /k "node server/queue-server.js"
        timeout /t 3 >nul
        echo.
        echo Opening demo interface...
        start hipaa-queue-demo.html
        echo.
        echo ========================================
        echo  Demo is running!
        echo  - Main server: http://localhost:8080
        echo  - Queue server: ws://localhost:8089
        echo  - Demo interface opened in browser
        echo.
        echo  Press any key to stop all servers...
        echo ========================================
        pause >nul
        taskkill /f /im node.exe 2>nul
    )
) else (
    echo.
    echo ========================================
    echo  ❌ SOME TESTS FAILED
    echo ========================================
    echo.
    echo Please check test-report.html for details
    start test-report.html
)

echo.
echo Test session complete.
pause