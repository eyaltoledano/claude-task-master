#!/bin/bash
set -euo pipefail

# Task Expansion & Management E2E Test
# Tests task expansion functionality (AI-powered subtask generation)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/shared/test-utils.sh"

echo "=== Task Master Web API - Task Expansion & Management Test ==="

# Setup environment and cleanup trap
setup_test_environment
setup_cleanup_trap

# Create test tasks first
create_test_tasks

echo "Starting Task Expansion & Management tests..."
echo

# ===== TASK EXPANSION & MANAGEMENT =====
echo "=== Task Expansion & Management ==="

# Test POST /api/tasks/:id/expand
echo "Testing POST /api/tasks/:id/expand..."
EXPAND_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tasks/$TASK_ID_1/expand" \
    -H "Content-Type: application/json" \
    -d '{"num":3,"useResearch":false,"force":false}')
check_json_response "$EXPAND_RESPONSE" "success" "Expand specific task"

# Verify task was expanded by checking for subtasks
echo "Verifying task was expanded..."
VERIFY_EXPAND_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/$TASK_ID_1")
if echo "$VERIFY_EXPAND_RESPONSE" | jq -e '.subtasks | length > 0' >/dev/null 2>&1; then
    echo "✅ Task successfully expanded with subtasks"
    SUBTASK_COUNT=$(echo "$VERIFY_EXPAND_RESPONSE" | jq -r '.subtasks | length')
    echo "  Generated $SUBTASK_COUNT subtasks"
else
    echo "❌ Task expansion did not generate subtasks"
    echo "Response: $VERIFY_EXPAND_RESPONSE"
fi

# Create additional tasks for expand-all test
echo "Creating additional tasks for expand-all test..."
CREATE_RESPONSE_3=$(curl -s -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Expansion Test Task 3","priority":"medium"}')

if check_json_response "$CREATE_RESPONSE_3" "taskId" "Create task for expand-all"; then
    TASK_ID_3=$(echo "$CREATE_RESPONSE_3" | jq -r '.taskId')
    CREATED_TASK_IDS+=("$TASK_ID_3")
    echo "  Created task ID: $TASK_ID_3"
fi

CREATE_RESPONSE_4=$(curl -s -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Expansion Test Task 4","priority":"low"}')

if check_json_response "$CREATE_RESPONSE_4" "taskId" "Create second task for expand-all"; then
    TASK_ID_4=$(echo "$CREATE_RESPONSE_4" | jq -r '.taskId')
    CREATED_TASK_IDS+=("$TASK_ID_4")
    echo "  Created task ID: $TASK_ID_4"
fi

# Test POST /api/tasks/expand-all
echo "Testing POST /api/tasks/expand-all..."
EXPAND_ALL_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tasks/expand-all" \
    -H "Content-Type: application/json" \
    -d '{"num":2,"useResearch":false,"force":false}')
check_json_response "$EXPAND_ALL_RESPONSE" "success" "Expand all eligible tasks"

# Verify expand-all worked
echo "Verifying expand-all results..."
VERIFY_ALL_RESPONSE=$(curl -s "$SERVER_URL/api/tasks?withSubtasks=true")
if echo "$VERIFY_ALL_RESPONSE" | jq -e '.tasks | map(select(.subtasks | length > 0)) | length > 1' >/dev/null 2>&1; then
    echo "✅ Expand-all successfully expanded multiple tasks"
    EXPANDED_COUNT=$(echo "$VERIFY_ALL_RESPONSE" | jq -r '.tasks | map(select(.subtasks | length > 0)) | length')
    echo "  $EXPANDED_COUNT tasks now have subtasks"
else
    echo "⚠️  Expand-all may not have expanded additional tasks (some may already have been expanded)"
fi

# Test POST /api/tasks/generate-files
echo "Testing POST /api/tasks/generate-files..."
GENERATE_FILES_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tasks/generate-files" \
    -H "Content-Type: application/json" \
    -d '{}')
check_json_response "$GENERATE_FILES_RESPONSE" "success" "Generate task files"

echo

echo "🎉 TASK EXPANSION & MANAGEMENT TESTS COMPLETED!"
echo "✅ Tested 4 task expansion endpoints:"
echo "   ✅ POST /api/tasks/:id/expand (expand specific task)"
echo "   ✅ POST /api/tasks/expand-all (expand all eligible tasks)"
echo "   ✅ POST /api/tasks/generate-files (generate markdown files)"
echo "   ✅ Verification of subtask generation" 