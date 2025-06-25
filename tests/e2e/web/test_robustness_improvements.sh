#!/bin/bash

# Test: Robustness Improvements for Task Master Web Server
# Verifies error recovery, health monitoring, and tag validation systems

set -e  # Exit on any error

# Configuration
TEST_PROJECT_ROOT="$PWD/tests/tmp/robustness-test"
TEST_PORT=3051
TEST_HOST="localhost"
TEST_URL="http://${TEST_HOST}:${TEST_PORT}"
TEST_TAG="robustness-test"
PID_FILE=""

# Test environment setup
source "$(dirname "$0")/shared/test-utils.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test results
print_test_result() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name - $message"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Function to test if server is responding
test_server_health() {
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$TEST_URL/api/health" > /dev/null 2>&1; then
            return 0
        fi
        echo "Waiting for server to start... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    return 1
}

# Function to test health monitoring endpoint
test_health_monitoring() {
    echo -e "\n${YELLOW}Testing Health Monitoring System...${NC}"
    
    # Test health endpoint response
    response=$(curl -s "$TEST_URL/api/health")
    
    if echo "$response" | jq -e '.health.overall' > /dev/null 2>&1; then
        health_status=$(echo "$response" | jq -r '.health.overall')
        if [ "$health_status" = "HEALTHY" ] || [ "$health_status" = "WARNING" ]; then
            print_test_result "Health monitoring endpoint" "PASS"
        else
            print_test_result "Health monitoring endpoint" "FAIL" "Health status: $health_status"
        fi
    else
        print_test_result "Health monitoring endpoint" "FAIL" "No health data in response"
    fi
    
    # Test health metrics are present
    if echo "$response" | jq -e '.health.metrics' > /dev/null 2>&1; then
        print_test_result "Health metrics collection" "PASS"
    else
        print_test_result "Health metrics collection" "FAIL" "No metrics in health response"
    fi
    
    # Test correlation ID is present
    if echo "$response" | jq -e '.correlationId' > /dev/null 2>&1; then
        print_test_result "Request correlation tracking" "PASS"
    else
        print_test_result "Request correlation tracking" "FAIL" "No correlation ID"
    fi
}

# Function to test error recovery
test_error_recovery() {
    echo -e "\n${YELLOW}Testing Error Recovery System...${NC}"
    
    # Test invalid task ID handling
    response=$(curl -s -w "%{http_code}" "$TEST_URL/api/tasks/999999" | tail -c 3)
    if [ "$response" = "404" ]; then
        print_test_result "Invalid task ID error handling" "PASS"
    else
        print_test_result "Invalid task ID error handling" "FAIL" "Expected 404, got $response"
    fi
    
    # Test malformed request body handling
    response=$(curl -s -w "%{http_code}" -X POST "$TEST_URL/api/tasks" \
        -H "Content-Type: application/json" \
        -d '{"invalid_json":}' | tail -c 3)
    if [ "$response" = "400" ]; then
        print_test_result "Malformed JSON error handling" "PASS"
    else
        print_test_result "Malformed JSON error handling" "FAIL" "Expected 400, got $response"
    fi
    
    # Test that server is still responsive after errors
    if curl -s "$TEST_URL/api/health" > /dev/null 2>&1; then
        print_test_result "Server resilience after errors" "PASS"
    else
        print_test_result "Server resilience after errors" "FAIL" "Server not responding"
    fi
}

# Function to test tag validation
test_tag_validation() {
    echo -e "\n${YELLOW}Testing Tag Validation System...${NC}"
    
    # Test creating a valid tag
    response=$(curl -s -w "%{http_code}" -X POST "$TEST_URL/api/tags" \
        -H "Content-Type: application/json" \
        -d "{\"tagName\":\"$TEST_TAG\",\"description\":\"Test tag for robustness\"}")
    
    http_code=$(echo "$response" | tail -c 4 | head -c 3)
    
    if [ "$http_code" = "201" ]; then
        print_test_result "Valid tag creation" "PASS"
    else
        print_test_result "Valid tag creation" "FAIL" "Expected 201, got $http_code"
    fi
    
    # Test invalid tag name handling
    response=$(curl -s -w "%{http_code}" -X POST "$TEST_URL/api/tags" \
        -H "Content-Type: application/json" \
        -d '{"tagName":"invalid tag name!","description":"Test"}' | tail -c 3)
    
    if [ "$response" = "400" ]; then
        print_test_result "Invalid tag name rejection" "PASS"
    else
        print_test_result "Invalid tag name rejection" "FAIL" "Expected 400, got $response"
    fi
    
    # Test using existing tag
    response=$(curl -s -w "%{http_code}" -X PUT "$TEST_URL/api/tags/use/$TEST_TAG" | tail -c 3)
    
    if [ "$response" = "200" ]; then
        print_test_result "Tag switching" "PASS"
    else
        print_test_result "Tag switching" "FAIL" "Expected 200, got $response"
    fi
    
    # Test using non-existent tag
    response=$(curl -s -w "%{http_code}" -X PUT "$TEST_URL/api/tags/use/nonexistent-tag" | tail -c 3)
    
    if [ "$response" = "404" ]; then
        print_test_result "Non-existent tag handling" "PASS"
    else
        print_test_result "Non-existent tag handling" "FAIL" "Expected 404, got $response"
    fi
}

# Function to test concurrent request handling
test_concurrent_requests() {
    echo -e "\n${YELLOW}Testing Concurrent Request Handling...${NC}"
    
    # Send multiple concurrent requests
    pids=()
    for i in {1..5}; do
        curl -s "$TEST_URL/api/health" > "/tmp/concurrent_test_$i.json" &
        pids+=($!)
    done
    
    # Wait for all requests to complete
    all_success=true
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            all_success=false
        fi
    done
    
    # Check all responses are valid
    for i in {1..5}; do
        if ! jq -e '.status' "/tmp/concurrent_test_$i.json" > /dev/null 2>&1; then
            all_success=false
        fi
        rm -f "/tmp/concurrent_test_$i.json"
    done
    
    if [ "$all_success" = true ]; then
        print_test_result "Concurrent request handling" "PASS"
    else
        print_test_result "Concurrent request handling" "FAIL" "Some requests failed"
    fi
}

# Function to test memory management
test_memory_management() {
    echo -e "\n${YELLOW}Testing Memory Management...${NC}"
    
    # Get initial memory usage from health endpoint
    initial_response=$(curl -s "$TEST_URL/api/health")
    initial_memory=$(echo "$initial_response" | jq -r '.health.metrics.memoryUsage.heapUsed // 0')
    
    if [ "$initial_memory" != "0" ] && [ "$initial_memory" != "null" ]; then
        print_test_result "Memory metrics collection" "PASS"
    else
        print_test_result "Memory metrics collection" "FAIL" "No valid memory metrics"
    fi
    
    # Test that memory tracking is working
    response=$(curl -s "$TEST_URL/api/health")
    memory_percent=$(echo "$response" | jq -r '.health.metrics.memoryUsage.percentage // 0')
    
    if [ "$memory_percent" != "0" ] && [ "$memory_percent" != "null" ]; then
        print_test_result "Memory percentage calculation" "PASS"
    else
        print_test_result "Memory percentage calculation" "FAIL" "Invalid memory percentage"
    fi
}

# Function to test graceful degradation
test_graceful_degradation() {
    echo -e "\n${YELLOW}Testing Graceful Degradation...${NC}"
    
    # Test with corrupted tag data (simulate by creating invalid JSON)
    echo '{"invalid":}' > "$TEST_PROJECT_ROOT/.taskmaster/tasks/tasks.json"
    
    # Server should still respond and attempt recovery
    response=$(curl -s -w "%{http_code}" "$TEST_URL/api/health" | tail -c 3)
    
    if [ "$response" = "200" ] || [ "$response" = "503" ]; then
        print_test_result "Graceful degradation with corrupted data" "PASS"
    else
        print_test_result "Graceful degradation with corrupted data" "FAIL" "Unexpected response: $response"
    fi
    
    # Restore valid data structure
    echo '{"master":{"tasks":[],"metadata":{"created":"'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'","updated":"'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'","description":"Tasks for master context"}}}' > "$TEST_PROJECT_ROOT/.taskmaster/tasks/tasks.json"
}

# Main test execution
main() {
    echo -e "${YELLOW}Task Master Web Server Robustness Test${NC}"
    echo "=============================================="
    
    # Clean up from any previous test runs
    cleanup_test_environment
    
    # Setup test environment
    echo -e "\n${YELLOW}Setting up test environment...${NC}"
    
    # Create test project directory
    mkdir -p "$TEST_PROJECT_ROOT"
    cd "$TEST_PROJECT_ROOT"
    
    # Initialize Task Master in test directory
    node "$PWD/scripts/modules/cli.js" init --yes --project-root="$TEST_PROJECT_ROOT" > /dev/null 2>&1 || true
    
    # Start web server in background
    echo "Starting web server on port $TEST_PORT..."
    node "$PWD/web/server.js" --port=$TEST_PORT --host=$TEST_HOST --project-root="$TEST_PROJECT_ROOT" > "/tmp/web_server_robustness.log" 2>&1 &
    SERVER_PID=$!
    PID_FILE="/tmp/web_server_robustness.pid"
    echo $SERVER_PID > "$PID_FILE"
    
    # Wait for server to start
    echo "Waiting for server to start..."
    if ! test_server_health; then
        echo -e "${RED}❌ Server failed to start${NC}"
        cleanup_test_environment
        exit 1
    fi
    
    echo -e "${GREEN}✓ Server started successfully${NC}"
    
    # Run robustness tests
    test_health_monitoring
    test_error_recovery
    test_tag_validation
    test_concurrent_requests
    test_memory_management
    test_graceful_degradation
    
    # Cleanup
    cleanup_test_environment
    
    # Print summary
    echo -e "\n${YELLOW}Test Summary${NC}"
    echo "=============="
    echo "Tests Run: $TESTS_RUN"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All robustness tests passed!${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed. Check the output above.${NC}"
        exit 1
    fi
}

# Cleanup function
cleanup_test_environment() {
    echo -e "\n${YELLOW}Cleaning up test environment...${NC}"
    
    # Stop server
    if [ -f "$PID_FILE" ]; then
        SERVER_PID=$(cat "$PID_FILE")
        if [ -n "$SERVER_PID" ]; then
            echo "Stopping server (PID: $SERVER_PID)..."
            kill "$SERVER_PID" 2>/dev/null || true
            sleep 2
            kill -9 "$SERVER_PID" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
    fi
    
    # Clean up test directory
    if [ -d "$TEST_PROJECT_ROOT" ]; then
        rm -rf "$TEST_PROJECT_ROOT"
    fi
    
    # Clean up temp files
    rm -f /tmp/concurrent_test_*.json
    rm -f /tmp/web_server_robustness.log
    
    echo "Cleanup completed."
}

# Trap cleanup on exit
trap cleanup_test_environment EXIT

# Run main test
main "$@" 