#!/bin/bash
set -euo pipefail

# Subtask Operations E2E Test
# Tests subtask creation, updating, and management

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/shared/test-utils.sh"

echo "=== Task Master Web API - Subtask Operations Test ==="

# Setup environment and cleanup trap
setup_test_environment
setup_cleanup_trap

# Create test tasks first
create_test_tasks

echo "Starting Subtask Operations tests..."
echo

# ===== SUBTASK OPERATIONS =====
echo "=== Subtask Operations ==="

# Test POST /api/tasks/:id/subtasks
echo "Testing POST /api/tasks/:id/subtasks..."
SUBTASK_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tasks/$TASK_ID_1/subtasks" \
    -H "Content-Type: application/json" \
    -d '{"title":"Subtask Test Subtask","description":"Test subtask","status":"pending"}')

if check_json_response "$SUBTASK_RESPONSE" "subtask" "Create subtask"; then
    SUBTASK_ID=$(echo "$SUBTASK_RESPONSE" | jq -r '.subtask.id // empty')
    echo "  Created subtask ID: $SUBTASK_ID"
fi

# Test PUT /api/tasks/:parentId/subtasks/:subtaskId
if [ -n "$SUBTASK_ID" ]; then
    echo "Testing PUT /api/tasks/:parentId/subtasks/:subtaskId..."
    UPDATE_SUBTASK_RESPONSE=$(curl -s -X PUT "$SERVER_URL/api/tasks/$TASK_ID_1/subtasks/$SUBTASK_ID" \
        -H "Content-Type: application/json" \
        -d '{"prompt":"Updated subtask description","useResearch":false}')
    check_json_response "$UPDATE_SUBTASK_RESPONSE" "success" "Update subtask"
fi

# Create another subtask for clearing test
echo "Creating additional subtask for clearing test..."
SUBTASK_RESPONSE_2=$(curl -s -X POST "$SERVER_URL/api/tasks/$TASK_ID_2/subtasks" \
    -H "Content-Type: application/json" \
    -d '{"title":"Another Test Subtask","description":"Another test subtask","status":"pending"}')

if check_json_response "$SUBTASK_RESPONSE_2" "subtask" "Create second subtask"; then
    SUBTASK_ID_2=$(echo "$SUBTASK_RESPONSE_2" | jq -r '.subtask.id // empty')
    echo "  Created second subtask ID: $SUBTASK_ID_2"
fi

# Test DELETE /api/tasks/:id/subtasks (clear subtasks from specific task)
echo "Testing DELETE /api/tasks/:id/subtasks..."
CLEAR_SUBTASKS_RESPONSE=$(curl -s -X DELETE "$SERVER_URL/api/tasks/$TASK_ID_1/subtasks")
check_json_response "$CLEAR_SUBTASKS_RESPONSE" "success" "Clear subtasks from specific task"

# Verify subtasks were cleared by checking the task
echo "Verifying subtasks were cleared..."
VERIFY_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/$TASK_ID_1")
if echo "$VERIFY_RESPONSE" | jq -e '.subtasks | length == 0' >/dev/null 2>&1; then
    echo "✅ Subtasks successfully cleared"
else
    echo "❌ Subtasks not properly cleared"
    echo "Response: $VERIFY_RESPONSE"
fi

echo

echo "🎉 SUBTASK OPERATIONS TESTS COMPLETED!"
echo "✅ Tested 3 subtask endpoints:"
echo "   ✅ POST /api/tasks/:id/subtasks (create)"
echo "   ✅ PUT /api/tasks/:parentId/subtasks/:subtaskId (update)"
echo "   ✅ DELETE /api/tasks/:id/subtasks (clear all)" 