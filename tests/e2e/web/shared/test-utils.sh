#!/bin/bash
# Shared utilities for Task Master Web API E2E tests

# Test configuration - no longer uses test mode
TEST_PORT=3002

# Global test variables with unique identifiers
CREATED_TASK_IDS=()
CREATED_TAG_NAMES=()
# Generate unique test tag using process ID and timestamp for isolation
TEST_TAG="test-$(date +%s)-$$"

# Server setup and validation
setup_test_environment() {
    echo "=== Setting up Test Environment with Tag-Based Isolation ==="
    
    # Check if server is running on test port (no test mode required)
    if curl -s http://localhost:$TEST_PORT/api/health >/dev/null 2>&1; then
        echo "✅ Using existing server on port $TEST_PORT"
        SERVER_URL="http://localhost:$TEST_PORT"
    else
        echo "❌ No server running on port $TEST_PORT. Please start the web server first:"
        echo "   npm run start:web -- --port $TEST_PORT --daemon"
        echo "   OR"
        echo "   node web/server.js --port=$TEST_PORT"
        exit 1
    fi

    # Verify server is responsive
    echo "🔍 Verifying server health..."
    HEALTH_RESPONSE=$(curl -s "$SERVER_URL/api/health")
    echo "Server health check: $HEALTH_RESPONSE"
    
    # Create unique test tag for isolation
    echo "🏷️  Creating test tag: $TEST_TAG"
    CREATE_TAG_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tags" \
        -H "Content-Type: application/json" \
        -d "{\"tagName\":\"$TEST_TAG\",\"description\":\"Automated test tag created at $(date)\"}")
    
    if echo "$CREATE_TAG_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
        echo "✅ Test tag created successfully"
        CREATED_TAG_NAMES+=("$TEST_TAG")
        
        # Switch to the test tag
        echo "🏷️  Switching to test tag: $TEST_TAG"
        USE_TAG_RESPONSE=$(curl -s -X PUT "$SERVER_URL/api/tags/use/$TEST_TAG" \
            -H "Content-Type: application/json" \
            -d '{}')
        
        if echo "$USE_TAG_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
            echo "✅ Switched to test tag successfully"
        else
            echo "❌ Failed to switch to test tag: $USE_TAG_RESPONSE"
            exit 1
        fi
    else
        echo "❌ Failed to create test tag: $CREATE_TAG_RESPONSE"
        exit 1
    fi
    
    echo "✅ Test environment isolated using tag: $TEST_TAG"
    echo "✅ All test operations will be isolated from production data"
    echo
}

# Helper function to check JSON response
check_json_response() {
    local response="$1"
    local expected_field="$2"
    local test_name="$3"
    
    if echo "$response" | jq -e ".$expected_field" >/dev/null 2>&1; then
        echo "✅ $test_name"
        return 0
    else
        echo "❌ $test_name failed"
        echo "Response: $response"
        return 1
    fi
}

# Helper function to check HTTP status code
check_status_code() {
    local expected_code="$1"
    local actual_response="$2"
    local test_name="$3"
    
    local actual_code=$(echo "$actual_response" | tail -n1 | grep -o 'HTTP_STATUS_CODE:[0-9]*' | cut -d: -f2)
    
    if [ "$actual_code" = "$expected_code" ]; then
        echo "✅ $test_name (HTTP $expected_code)"
        return 0
    else
        echo "❌ $test_name failed - expected HTTP $expected_code, got HTTP $actual_code"
        echo "Response: $actual_response"
        return 1
    fi
}

# Helper function to test validation errors
test_validation_error() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo "🔍 Testing validation: $description"
    
    # Always append tag parameter to validation test endpoints
    local tag_param="tag=$TEST_TAG"
    if [[ "$endpoint" == *"?"* ]]; then
        endpoint="${endpoint}&${tag_param}"
    else
        endpoint="${endpoint}?${tag_param}"
    fi
    
    local response
    if [ "$method" = "GET" ] || [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "%{http_code}" -X "$method" "$SERVER_URL$endpoint" || true)
    else
        response=$(curl -s -w "%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$SERVER_URL$endpoint" || true)
    fi
    
    local status_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$status_code" -eq 400 ]; then
        echo "✅ Validation error correctly returned HTTP 400"
        # Check if response contains validation error details
        if echo "$body" | grep -q "Validation Error"; then
            echo "✅ Response contains validation error details"
        else
            echo "⚠️  Response missing validation error details"
        fi
        return 0
    else
        echo "❌ Expected HTTP 400 for validation error, got $status_code"
        echo "Response: $body"
        return 1
    fi
}

# Enhanced cleanup function with tag-based isolation
cleanup_test_data() {
    echo "Cleaning up test data..."
    
    # Delete created tasks within our test tag (if any)
    if [ ${#CREATED_TASK_IDS[@]} -gt 0 ]; then
        for task_id in "${CREATED_TASK_IDS[@]}"; do
            curl -s -X DELETE "$SERVER_URL/api/tasks/$task_id?tag=$TEST_TAG" >/dev/null 2>&1 || true
        done
    fi
    
    # Delete the entire test tag - this removes all test data at once
    if [ ${#CREATED_TAG_NAMES[@]} -gt 0 ]; then
        for tag_name in "${CREATED_TAG_NAMES[@]}"; do
            echo "🧹 Deleting test tag: $tag_name"
            curl -s -X DELETE "$SERVER_URL/api/tags/$tag_name?force=true" >/dev/null 2>&1 || true
        done
    fi
    
    echo "✅ Test cleanup completed"
}

# Create test tasks for dependency testing
create_test_tasks() {
    echo "Creating test tasks in tag: $TEST_TAG..."
    
    # Use unique prompts to avoid conflicts in parallel execution
    local unique_id="$$-$(date +%s)"
    
    # Create first task within test tag
    CREATE_RESPONSE_1=$(curl -s -X POST "$SERVER_URL/api/tasks?tag=$TEST_TAG" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\":\"API Test Task 1 - $unique_id\",\"priority\":\"medium\",\"dependencies\":[]}")

    if check_json_response "$CREATE_RESPONSE_1" "taskId" "Create test task 1"; then
        TASK_ID_1=$(echo "$CREATE_RESPONSE_1" | jq -r '.taskId')
        CREATED_TASK_IDS+=("$TASK_ID_1")
        echo "  Created task ID: $TASK_ID_1"
    fi

    # Create second task within test tag
    CREATE_RESPONSE_2=$(curl -s -X POST "$SERVER_URL/api/tasks?tag=$TEST_TAG" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\":\"API Test Task 2 - $unique_id\",\"priority\":\"high\"}")

    if check_json_response "$CREATE_RESPONSE_2" "taskId" "Create test task 2"; then
        TASK_ID_2=$(echo "$CREATE_RESPONSE_2" | jq -r '.taskId')
        CREATED_TASK_IDS+=("$TASK_ID_2")
        echo "  Created task ID: $TASK_ID_2"
    fi
    
    echo
}

# Generate unique IDs for testing to avoid conflicts
generate_unique_id() {
    echo $(($(date +%s) % 10000 + 9000))
}

# Set up trap for cleanup
setup_cleanup_trap() {
    trap cleanup_test_data EXIT
}

# Utility function to append tag parameter to URLs
append_tag_param() {
    local url="$1"
    local tag="${2:-$TEST_TAG}"
    
    if [[ "$url" == *"?"* ]]; then
        echo "${url}&tag=${tag}"
    else
        echo "${url}?tag=${tag}"
    fi
}

# Export functions and variables for use in other scripts
export -f check_json_response
export -f check_status_code
export -f test_validation_error
export -f cleanup_test_data
export -f create_test_tasks
export -f generate_unique_id
export -f setup_cleanup_trap
export -f setup_test_environment
export -f append_tag_param

export SERVER_URL
export CREATED_TASK_IDS
export CREATED_TAG_NAMES
export TEST_TAG
export TASK_ID_1
export TASK_ID_2 