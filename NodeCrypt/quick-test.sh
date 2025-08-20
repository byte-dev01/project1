#!/bin/bash

echo "========================================"
echo " HIPAA Medical Chat - Quick Test Suite"
echo "========================================"
echo ""

echo "[1] Running automated tests..."
echo ""

node test-runner.js
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    echo ""
    echo "========================================"
    echo " ✅ ALL TESTS PASSED"
    echo "========================================"
    echo ""
    echo "[2] Opening test report..."
    
    # Detect OS and open report
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open test-report.html
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open test-report.html
    fi
    
    echo ""
    echo "[3] Would you like to start the demo? (y/n)"
    read -r demo
    
    if [[ "$demo" == "y" || "$demo" == "Y" ]]; then
        echo ""
        echo "Starting servers..."
        
        # Start servers in background
        node server/hipaa-server.js &
        SERVER1_PID=$!
        sleep 2
        
        node server/queue-server.js &
        SERVER2_PID=$!
        sleep 3
        
        echo ""
        echo "Opening demo interface..."
        
        # Open demo in browser
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open hipaa-queue-demo.html
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open hipaa-queue-demo.html
        fi
        
        echo ""
        echo "========================================"
        echo " Demo is running!"
        echo " - Main server: http://localhost:8080"
        echo " - Queue server: ws://localhost:8089"
        echo " - Demo interface opened in browser"
        echo ""
        echo " Press Enter to stop all servers..."
        echo "========================================"
        read -r
        
        # Stop servers
        kill $SERVER1_PID 2>/dev/null
        kill $SERVER2_PID 2>/dev/null
        echo "Servers stopped."
    fi
else
    echo ""
    echo "========================================"
    echo " ❌ SOME TESTS FAILED"
    echo "========================================"
    echo ""
    echo "Please check test-report.html for details"
    
    # Open report
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open test-report.html
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open test-report.html
    fi
fi

echo ""
echo "Test session complete."