#!/bin/bash
set -euo pipefail

# Task Movement E2E Test
# Tests task movement and reorganization functionality

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/shared/test-utils.sh"

echo "=== Task Master Web API - Task Movement Test ==="

# Setup environment and cleanup trap
setup_test_environment
setup_cleanup_trap

# Create test tasks first
create_test_tasks

echo "Starting Task Movement tests..."
echo

# ===== TASK MOVEMENT =====
echo "=== Task Movement ==="

# Create additional tasks for movement testing
echo "Creating additional tasks for movement testing..."
CREATE_RESPONSE_3=$(curl -s -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Movement Test Task 3","priority":"low"}')

if check_json_response "$CREATE_RESPONSE_3" "taskId" "Create task for movement"; then
    TASK_ID_3=$(echo "$CREATE_RESPONSE_3" | jq -r '.taskId')
    CREATED_TASK_IDS+=("$TASK_ID_3")
    echo "  Created task ID: $TASK_ID_3"
fi

CREATE_RESPONSE_4=$(curl -s -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Movement Test Task 4","priority":"medium"}')

if check_json_response "$CREATE_RESPONSE_4" "taskId" "Create second task for movement"; then
    TASK_ID_4=$(echo "$CREATE_RESPONSE_4" | jq -r '.taskId')
    CREATED_TASK_IDS+=("$TASK_ID_4")
    echo "  Created task ID: $TASK_ID_4"
fi

# Test PUT /api/tasks/:fromId/move/:toId (single task move)
echo "Testing PUT /api/tasks/:fromId/move/:toId..."
# Use a unique timestamp-based ID to avoid conflicts
UNIQUE_MOVE_ID=$(generate_unique_id)
MOVE_RESPONSE=$(curl -s -X PUT "$SERVER_URL/api/tasks/$TASK_ID_3/move/$UNIQUE_MOVE_ID" \
    -H "Content-Type: application/json" \
    -d '{}')
check_json_response "$MOVE_RESPONSE" "success" "Move single task"

# Verify the task was moved
echo "Verifying single task move..."
VERIFY_MOVE_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/$UNIQUE_MOVE_ID")
if check_json_response "$VERIFY_MOVE_RESPONSE" "id" "Verify moved task exists at new ID"; then
    echo "✅ Task successfully moved to new ID: $UNIQUE_MOVE_ID"
    # Update our tracking
    CREATED_TASK_IDS=("${CREATED_TASK_IDS[@]/$TASK_ID_3}")
    CREATED_TASK_IDS+=("$UNIQUE_MOVE_ID")
else
    echo "❌ Task move verification failed"
fi

# Test PUT /api/tasks/move-batch (batch move)
echo "Testing PUT /api/tasks/move-batch..."
# Use unique timestamp-based IDs to avoid conflicts
UNIQUE_BATCH_MOVE_ID_1=$(generate_unique_id)
UNIQUE_BATCH_MOVE_ID_2=$((UNIQUE_BATCH_MOVE_ID_1 + 1))

MOVE_BATCH_RESPONSE=$(curl -s -X PUT "$SERVER_URL/api/tasks/move-batch" \
    -H "Content-Type: application/json" \
    -d "{\"from\":[\"$TASK_ID_1\",\"$TASK_ID_4\"],\"to\":[\"$UNIQUE_BATCH_MOVE_ID_1\",\"$UNIQUE_BATCH_MOVE_ID_2\"]}")
check_json_response "$MOVE_BATCH_RESPONSE" "success" "Move multiple tasks"

# Verify the batch move worked
echo "Verifying batch move..."
VERIFY_BATCH_1_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/$UNIQUE_BATCH_MOVE_ID_1")
VERIFY_BATCH_2_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/$UNIQUE_BATCH_MOVE_ID_2")

if check_json_response "$VERIFY_BATCH_1_RESPONSE" "id" "Verify first batch moved task" && \
   check_json_response "$VERIFY_BATCH_2_RESPONSE" "id" "Verify second batch moved task"; then
    echo "✅ Batch move successfully moved both tasks"
    echo "  Task moved to ID: $UNIQUE_BATCH_MOVE_ID_1"
    echo "  Task moved to ID: $UNIQUE_BATCH_MOVE_ID_2"
    
    # Update our tracking
    CREATED_TASK_IDS=("${CREATED_TASK_IDS[@]/$TASK_ID_1}")
    CREATED_TASK_IDS=("${CREATED_TASK_IDS[@]/$TASK_ID_4}")
    CREATED_TASK_IDS+=("$UNIQUE_BATCH_MOVE_ID_1")
    CREATED_TASK_IDS+=("$UNIQUE_BATCH_MOVE_ID_2")
else
    echo "❌ Batch move verification failed"
fi

# Test error handling - try to move to existing task ID
echo "Testing error handling with conflicting move destination..."
CONFLICT_MOVE_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X PUT "$SERVER_URL/api/tasks/$TASK_ID_2/move/$UNIQUE_MOVE_ID" \
    -H "Content-Type: application/json" \
    -d '{}')

CONFLICT_STATUS_CODE="${CONFLICT_MOVE_RESPONSE: -3}"
if [ "$CONFLICT_STATUS_CODE" -eq 409 ] || [ "$CONFLICT_STATUS_CODE" -eq 400 ]; then
    echo "✅ Move to existing ID correctly rejected (HTTP $CONFLICT_STATUS_CODE)"
else
    echo "❌ Move to existing ID not properly handled (HTTP $CONFLICT_STATUS_CODE)"
fi

# Test error handling - try to move non-existent task
echo "Testing error handling with non-existent source task..."
NONEXISTENT_MOVE_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X PUT "$SERVER_URL/api/tasks/99999/move/88888" \
    -H "Content-Type: application/json" \
    -d '{}')

NONEXISTENT_STATUS_CODE="${NONEXISTENT_MOVE_RESPONSE: -3}"
if [ "$NONEXISTENT_STATUS_CODE" -eq 404 ]; then
    echo "✅ Move of non-existent task correctly rejected (HTTP 404)"
else
    echo "❌ Move of non-existent task not properly handled (HTTP $NONEXISTENT_STATUS_CODE)"
fi

# Test batch move error handling - mismatched array lengths
echo "Testing batch move error handling with mismatched arrays..."
MISMATCH_BATCH_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X PUT "$SERVER_URL/api/tasks/move-batch" \
    -H "Content-Type: application/json" \
    -d '{"from":["1","2","3"],"to":["100","200"]}')

MISMATCH_STATUS_CODE="${MISMATCH_BATCH_RESPONSE: -3}"
if [ "$MISMATCH_STATUS_CODE" -eq 400 ]; then
    echo "✅ Mismatched batch move arrays correctly rejected (HTTP 400)"
else
    echo "❌ Mismatched batch move arrays not properly handled (HTTP $MISMATCH_STATUS_CODE)"
fi

echo

echo "🎉 TASK MOVEMENT TESTS COMPLETED!"
echo "✅ Tested 2 task movement endpoints:"
echo "   ✅ PUT /api/tasks/:fromId/move/:toId (single task move)"
echo "   ✅ PUT /api/tasks/move-batch (batch task move)"
echo "   ✅ Error handling for conflicting destinations"
echo "   ✅ Error handling for non-existent source tasks"
echo "   ✅ Error handling for mismatched batch arrays" 