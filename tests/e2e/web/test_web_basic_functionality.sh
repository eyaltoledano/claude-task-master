#!/bin/bash
set -euo pipefail

# Source the existing helper framework (like all other E2E tests)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$PROJECT_ROOT/tests/e2e/e2e_helpers.sh"

# Constants
TEST_DIR="/tmp/taskmaster-web-test-$$"
CLI_CMD="node $PROJECT_ROOT/bin/task-master.js"
TEST_PORT="3005"

# Simple cleanup function
cleanup() {
    echo "Cleaning up..."
    
    # Stop server and kill any processes on test port
    safe_run_cmd 10 "cleanup-stop" $CLI_CMD web-stop --force >/dev/null 2>&1 || true
    
    # Kill any remaining processes on the test port
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti:$TEST_PORT | xargs kill -9 2>/dev/null || true
    fi
    
    # Remove temp directory
    if [ -n "${TEST_DIR:-}" ] && [ -d "$TEST_DIR" ]; then
        cd /tmp
        rm -rf "$TEST_DIR"
    fi
}
trap cleanup EXIT

# Use structured logging like other E2E tests
echo "=== Task Master Web Server E2E Test ==="
echo "Project Root: $PROJECT_ROOT"
echo "Test Directory: $TEST_DIR" 
echo "Test Port: $TEST_PORT"
echo

# Setup test environment
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Initialize minimal taskmaster setup (non-interactive)
echo "Setting up test environment..."
safe_run_cmd 30 "basic-test-init" $CLI_CMD init -y --name="WebTest" --description="E2E Test" >/dev/null

echo

# Test 1: Status with no server
log_step "Checking web-status with no server running"
status_output=$(expect_success 10 "web-status-no-server" $CLI_CMD web-status)
extract_and_sum_cost "$status_output"
if echo "$status_output" | grep -q "Running:.*No"; then
    log_success "Status correctly shows no server running"
else
    log_error "Expected 'Running: No' in output: $status_output"
    exit 1
fi

# Test 2: Start server in daemon mode
log_step "Starting web server in daemon mode"
start_output=$(expect_success 30 "web-start-daemon" $CLI_CMD web-start --port=$TEST_PORT --daemon)
extract_and_sum_cost "$start_output"
if echo "$start_output" | grep -q "started"; then
    log_success "Server started successfully"
    # Give server a moment to fully start
    sleep 2
else
    log_error "Server start failed: $start_output"
    exit 1
fi

# Test 3: Status with server running
log_step "Checking web-status with server running"
status_output=$(expect_success 10 "web-status-running" $CLI_CMD web-status)
extract_and_sum_cost "$status_output"
if echo "$status_output" | grep -q "Running:.*Yes" && echo "$status_output" | grep -q "$TEST_PORT"; then
    log_success "Status correctly shows server running on port $TEST_PORT"
else
    log_error "Expected 'Running: Yes' and port $TEST_PORT in output: $status_output"
    exit 1
fi

# Test 4: Stop server gracefully
log_step "Stopping web server gracefully"
stop_output=$(expect_success 15 "web-stop-graceful" $CLI_CMD web-stop)
extract_and_sum_cost "$stop_output"
if echo "$stop_output" | grep -q -E "(stopped|shutdown)"; then
    log_success "Server stopped successfully"
    # Give server a moment to fully stop
    sleep 2
else
    log_error "Server stop failed: $stop_output"
    exit 1
fi

# Test 5: Status after stop
log_step "Checking web-status after server stop"
status_output=$(expect_success 10 "web-status-after-stop" $CLI_CMD web-status)
extract_and_sum_cost "$status_output"
if echo "$status_output" | grep -q "Running:.*No"; then
    log_success "Status correctly shows no server running after stop"
else
    log_error "Expected 'Running: No' after stop: $status_output"
    exit 1
fi

echo
echo "=== ALL TESTS PASSED! ==="
echo "✅ Web server basic functionality verified:"
echo "   - Status command works correctly"
echo "   - Server starts in daemon mode" 
echo "   - Server stops gracefully"
echo "   - Status tracking works properly"
echo
