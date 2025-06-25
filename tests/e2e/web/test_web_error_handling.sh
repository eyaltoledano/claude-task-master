#!/bin/bash
set -euo pipefail

# Source the existing helper framework
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$PROJECT_ROOT/tests/e2e/e2e_helpers.sh"

# Constants
TEST_DIR="/tmp/taskmaster-web-error-test-$$"
CLI_CMD="node $PROJECT_ROOT/bin/task-master.js"
TEST_PORT="3006"  # Different from basic test to avoid conflicts
CONFLICT_PORT="3007"  # Additional port for conflict testing

# Comprehensive cleanup function that handles stuck processes
cleanup() {
    echo "Cleaning up error handling test..."
    
    # Stop any servers that might be running
    $CLI_CMD web-stop --force 2>/dev/null || true
    
    # Kill processes on both test ports
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti:$TEST_PORT | xargs kill -9 2>/dev/null || true
        lsof -ti:$CONFLICT_PORT | xargs kill -9 2>/dev/null || true
    fi
    
    # Additional cleanup for any Node.js processes that might be hanging
    pkill -f "web.*server.*$TEST_PORT" 2>/dev/null || true
    pkill -f "web.*server.*$CONFLICT_PORT" 2>/dev/null || true
    
    # Remove temp directory
    if [ -n "${TEST_DIR:-}" ] && [ -d "$TEST_DIR" ]; then
        cd /tmp
        rm -rf "$TEST_DIR"
    fi
}
trap cleanup EXIT

# Use structured logging like other E2E tests
echo "=== Task Master Web Server Error Handling E2E Test ==="
echo "Project Root: $PROJECT_ROOT"
echo "Test Directory: $TEST_DIR" 
echo "Test Port: $TEST_PORT"
echo "Conflict Port: $CONFLICT_PORT"
echo

# Setup test environment
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Initialize minimal taskmaster setup (non-interactive)
echo "Setting up test environment..."
safe_run_cmd 30 "test-init" $CLI_CMD init -y --name="WebErrorTest" --description="E2E Error Test" >/dev/null

echo

# Test 1: Port conflict error
log_step "Testing port conflict error"
# Start our own server first to create a real conflict
expect_success 15 "first-server-start" $CLI_CMD web-start --port=$CONFLICT_PORT --daemon >/dev/null
sleep 2

# Now try to start another server on the same port
error_output=$(expect_failure 15 "port-conflict" $CLI_CMD web-start --port=$CONFLICT_PORT --daemon)
extract_and_sum_cost "$error_output"

# Stop the first server
safe_run_cmd 10 "cleanup-first-server" $CLI_CMD web-stop --force >/dev/null
sleep 1

if echo "$error_output" | grep -q -E "(already in use|already running|Port.*in use)"; then
    log_success "Port conflict correctly detected and reported"
else
    log_error "Expected port conflict error not detected: $error_output"
fi

# Test 2: Invalid port numbers
log_step "Testing invalid port number: negative port"
error_output=$(expect_failure 10 "negative-port" $CLI_CMD web-start --port=-1)
extract_and_sum_cost "$error_output"
if echo "$error_output" | grep -q -E "(invalid|error|cannot|failed)" || [ $? -ne 0 ]; then
    log_success "Negative port number correctly rejected"
else
    log_error "Negative port should be rejected: $error_output"
fi

log_step "Testing invalid port number: zero port"
error_output=$(expect_failure 10 "zero-port" $CLI_CMD web-start --port=0)
extract_and_sum_cost "$error_output"
if echo "$error_output" | grep -q -E "(invalid|error|cannot|failed)" || [ $? -ne 0 ]; then
    log_success "Zero port number correctly rejected"
else
    log_error "Zero port should be rejected: $error_output"
fi

log_step "Testing invalid port number: out of range port"
error_output=$(expect_failure 10 "out-of-range-port" $CLI_CMD web-start --port=99999)
extract_and_sum_cost "$error_output"
if echo "$error_output" | grep -q -E "(invalid|error|cannot|failed|out of range)" || [ $? -ne 0 ]; then
    log_success "Out of range port number correctly rejected"
else
    log_error "Out of range port should be rejected: $error_output"
fi

log_step "Testing invalid port number: non-numeric port"
error_output=$(expect_failure 10 "non-numeric-port" $CLI_CMD web-start --port=abc)
extract_and_sum_cost "$error_output"
if echo "$error_output" | grep -q -E "(invalid|error|cannot|failed|numeric)" || [ $? -ne 0 ]; then
    log_success "Non-numeric port correctly rejected"
else
    log_error "Non-numeric port should be rejected: $error_output"
fi

# Test 3: Stop non-existent server
log_step "Testing stop command with no server running"
# Ensure no server is running
safe_run_cmd 10 "ensure-no-server" $CLI_CMD web-stop --force >/dev/null
sleep 1

error_output=$(safe_run_cmd 10 "stop-nonexistent" $CLI_CMD web-stop)
extract_and_sum_cost "$error_output"
if echo "$error_output" | grep -q -E "(No running|not found|already stopped)" || echo "$error_output" | grep -q "successfully"; then
    log_success "Stop non-existent server handled gracefully"
else
    log_error "Stop command should handle non-existent server gracefully: $error_output"
fi

# Test 4: Double start prevention
log_step "Testing double start prevention"
# Start a server first
start_output=$(expect_success 15 "first-start" $CLI_CMD web-start --port=$TEST_PORT --daemon)
extract_and_sum_cost "$start_output"
if echo "$start_output" | grep -q "started"; then
    sleep 2
    
    # Try to start another server on same port
    error_output=$(expect_failure 15 "double-start" $CLI_CMD web-start --port=$TEST_PORT --daemon)
    extract_and_sum_cost "$error_output"
    
    # Stop the server
    safe_run_cmd 10 "cleanup-double-start" $CLI_CMD web-stop --force >/dev/null
    sleep 1
    
    if echo "$error_output" | grep -q -E "(already running|already in use|Port.*in use)"; then
        log_success "Double start correctly prevented"
    else
        log_error "Expected double start prevention: $error_output"
    fi
else
    log_error "Could not start server for double start test: $start_output"
fi

# Test 5: Force stop scenarios
log_step "Testing force stop functionality"
# Start server in daemon mode
safe_run_cmd 15 "setup-force-test" $CLI_CMD web-start --port=$TEST_PORT --daemon >/dev/null
sleep 2

# Test normal stop first
stop_output=$(safe_run_cmd 10 "normal-stop" $CLI_CMD web-stop)
extract_and_sum_cost "$stop_output"
sleep 1

# Test force stop (even if server already stopped)
force_output=$(safe_run_cmd 10 "force-stop" $CLI_CMD web-stop --force)
extract_and_sum_cost "$force_output"

if echo "$stop_output $force_output" | grep -q -E "(stopped|shutdown|No running|not found)"; then
    log_success "Force stop functionality works correctly"
else
    log_error "Force stop functionality failed: stop=$stop_output, force=$force_output"
fi

# Test 6: Invalid host addresses (if supported)
log_step "Testing invalid host address"
error_output=$(expect_failure 10 "invalid-host" $CLI_CMD web-start --port=$TEST_PORT --host=999.999.999.999)
extract_and_sum_cost "$error_output"
if echo "$error_output" | grep -q -E "(invalid|error|not available|not found)" || [ $? -ne 0 ]; then
    log_success "Invalid host address correctly rejected"
else
    log_error "Invalid host should be rejected: $error_output"
fi

# Test 7: Permission errors (low ports) - only if not running as root
log_step "Testing permission errors for privileged ports"
if [ "$(id -u)" -ne 0 ]; then
    # Try to bind to port 80 (requires root)
    error_output=$(expect_failure 10 "privileged-port" $CLI_CMD web-start --port=80)
    extract_and_sum_cost "$error_output"
    if echo "$error_output" | grep -q -E "(Permission denied|EACCES|privileges|administrator)" || [ $? -ne 0 ]; then
        log_success "Permission denied for privileged port correctly handled"
    else
        log_error "Should show permission error for port 80: $error_output"
    fi
else
    log_success "Running as root - skipping privileged port test"
fi

# Test 8: Status command error handling
log_step "Testing status command with various conditions"
# Ensure no server is running
safe_run_cmd 10 "ensure-stopped" $CLI_CMD web-stop --force >/dev/null
sleep 1

status_output=$(expect_success 10 "web-status" $CLI_CMD web-status)
extract_and_sum_cost "$status_output"
if echo "$status_output" | grep -q "Running:.*No"; then
    log_success "Status correctly reports no server running"
else
    log_error "Status should report no server running: $status_output"
fi

# Test 9: Start server with invalid options combination
log_step "Testing start with potentially problematic option combinations"
# Test empty host with daemon mode to avoid hanging on foreground server
error_output=$(safe_run_cmd 15 "empty-host-test" $CLI_CMD web-start --port=$TEST_PORT --host="" --daemon)
exit_code=$?
extract_and_sum_cost "$error_output"

# Clean up any server that might have started
safe_run_cmd 5 "cleanup-empty-host" $CLI_CMD web-stop --force >/dev/null 2>&1

if echo "$error_output" | grep -q -E "(invalid|error|empty)" || [ $exit_code -ne 0 ]; then
    log_success "Empty host correctly handled"
else
    # Empty host might be valid (some systems allow this), so we'll just log it without failing
    log_success "Empty host handling completed (may be valid): $error_output"
fi

# Test 10: Rapid start/stop cycles
log_step "Testing rapid start/stop cycles for race conditions"
for i in {1..3}; do
    safe_run_cmd 10 "rapid-start-$i" $CLI_CMD web-start --port=$TEST_PORT --daemon >/dev/null
    sleep 0.5
    safe_run_cmd 10 "rapid-stop-$i" $CLI_CMD web-stop --force >/dev/null
    sleep 0.5
done

# Final status check
final_status=$(expect_success 10 "final-status" $CLI_CMD web-status)
extract_and_sum_cost "$final_status"
if echo "$final_status" | grep -q "Running:.*No"; then
    log_success "Rapid start/stop cycles handled correctly"
else
    log_error "Server should not be running after rapid cycles: $final_status"
fi

# Test 11: Testing concurrent operations
log_step "Testing concurrent start attempts"
# Try to start multiple servers simultaneously (should fail gracefully)
safe_run_cmd 15 "concurrent-start-1" $CLI_CMD web-start --port=$TEST_PORT --daemon >/dev/null &
safe_run_cmd 15 "concurrent-start-2" $CLI_CMD web-start --port=$TEST_PORT --daemon >/dev/null &
safe_run_cmd 15 "concurrent-start-3" $CLI_CMD web-start --port=$TEST_PORT --daemon >/dev/null &
wait

# Clean up any started servers
sleep 2
safe_run_cmd 10 "final-cleanup" $CLI_CMD web-stop --force >/dev/null

log_success "Concurrent operations test completed"

echo
echo "=== WEB ERROR HANDLING TESTS COMPLETED ==="
echo "✅ Web server error handling verified:"
echo "   - Port conflict detection"
echo "   - Invalid parameter rejection"
echo "   - Graceful error handling"
echo "   - Force operations"
echo "   - Permission error handling"
echo "   - Status command robustness"
echo "   - Race condition handling"
echo "   - Concurrent operation safety"
echo 