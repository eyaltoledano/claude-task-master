#!/bin/bash
set -euo pipefail

# Core Task Operations E2E Test
# Tests basic CRUD operations on tasks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/shared/test-utils.sh"

echo "=== Task Master Web API - Core Task Operations Test ==="

# Setup environment and cleanup trap
setup_test_environment
setup_cleanup_trap

echo "Starting Core Task Operations tests..."
echo

# ===== HEALTH CHECK =====
echo "=== Health Check ==="
HEALTH_RESPONSE=$(curl -s "$SERVER_URL/api/health")
check_json_response "$HEALTH_RESPONSE" "status" "Health endpoint"
echo

# ===== CORE TASK OPERATIONS =====
echo "=== Core Task Operations ==="

# Test GET /api/tasks
echo "Testing GET /api/tasks..."
TASKS_RESPONSE=$(curl -s "$SERVER_URL/api/tasks")
check_json_response "$TASKS_RESPONSE" "tasks" "List all tasks"

# Test GET /api/tasks with query parameters
echo "Testing GET /api/tasks with query parameters..."
FILTERED_RESPONSE=$(curl -s "$SERVER_URL/api/tasks?status=pending&withSubtasks=true")
check_json_response "$FILTERED_RESPONSE" "tasks" "List tasks with filters"

# Test POST /api/tasks (create task)
echo "Testing POST /api/tasks..."
CREATE_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Core Test Task 1","priority":"medium","dependencies":[]}')

if check_json_response "$CREATE_RESPONSE" "taskId" "Create new task"; then
    TASK_ID_1=$(echo "$CREATE_RESPONSE" | jq -r '.taskId')
    CREATED_TASK_IDS+=("$TASK_ID_1")
    echo "  Created task ID: $TASK_ID_1"
fi

# Create a second task for testing
CREATE_RESPONSE_2=$(curl -s -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Core Test Task 2","priority":"high"}')

if check_json_response "$CREATE_RESPONSE_2" "taskId" "Create second task"; then
    TASK_ID_2=$(echo "$CREATE_RESPONSE_2" | jq -r '.taskId')
    CREATED_TASK_IDS+=("$TASK_ID_2")
    echo "  Created task ID: $TASK_ID_2"
fi

# Test GET /api/tasks/next
echo "Testing GET /api/tasks/next..."
NEXT_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/next")
check_json_response "$NEXT_RESPONSE" "nextTask" "Get next available task"

# Test GET /api/tasks/:id (single ID)
echo "Testing GET /api/tasks/:id (single task)..."
SHOW_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/$TASK_ID_1")
check_json_response "$SHOW_RESPONSE" "id" "Show specific task"

# Test GET /api/tasks/:ids (multiple IDs)
echo "Testing GET /api/tasks/:ids (multiple tasks)..."
SHOW_MULTI_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/$TASK_ID_1,$TASK_ID_2")
if echo "$SHOW_MULTI_RESPONSE" | jq -e '. | length >= 2' >/dev/null; then
    echo "✅ Show multiple tasks"
else
    echo "❌ Show multiple tasks failed"
    echo "Response: $SHOW_MULTI_RESPONSE"
fi

# Test PUT /api/tasks/:id (update task)
echo "Testing PUT /api/tasks/:id..."
UPDATE_RESPONSE=$(curl -s -X PUT "$SERVER_URL/api/tasks/$TASK_ID_1" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Updated task description","useResearch":false}')
check_json_response "$UPDATE_RESPONSE" "success" "Update specific task"

# Test PUT /api/tasks/bulk-update
echo "Testing PUT /api/tasks/bulk-update..."
BULK_UPDATE_RESPONSE=$(curl -s -X PUT "$SERVER_URL/api/tasks/bulk-update" \
    -H "Content-Type: application/json" \
    -d "{\"from\":\"$TASK_ID_1\",\"prompt\":\"Bulk update test\",\"useResearch\":false}")
check_json_response "$BULK_UPDATE_RESPONSE" "success" "Bulk update tasks"

# Test PATCH /api/tasks/:id/status
echo "Testing PATCH /api/tasks/:id/status..."
STATUS_RESPONSE=$(curl -s -X PATCH "$SERVER_URL/api/tasks/$TASK_ID_1/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"in-progress"}')
check_json_response "$STATUS_RESPONSE" "success" "Set task status"

# Test DELETE /api/tasks/:id
echo "Testing DELETE /api/tasks/:id..."
DELETE_TASK_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X DELETE "$SERVER_URL/api/tasks/$TASK_ID_2")
check_status_code "204" "$DELETE_TASK_RESPONSE" "Delete task returns 204"

echo

echo "🎉 CORE TASK OPERATIONS TESTS COMPLETED!"
echo "✅ Tested 8 core task endpoints:"
echo "   ✅ GET /api/health"
echo "   ✅ GET /api/tasks (list all)"
echo "   ✅ GET /api/tasks (with filters)"
echo "   ✅ POST /api/tasks (create)"
echo "   ✅ GET /api/tasks/next"
echo "   ✅ GET /api/tasks/:id (single)"
echo "   ✅ GET /api/tasks/:ids (multiple)"
echo "   ✅ PUT /api/tasks/:id (update)"
echo "   ✅ PUT /api/tasks/bulk-update"
echo "   ✅ PATCH /api/tasks/:id/status"
echo "   ✅ DELETE /api/tasks/:id" 