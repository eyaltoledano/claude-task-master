#!/bin/bash
set -euo pipefail

# Dependency Management E2E Test
# Tests task dependency creation, validation, and management

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/shared/test-utils.sh"

echo "=== Task Master Web API - Dependency Management Test ==="

# Setup environment and cleanup trap
setup_test_environment
setup_cleanup_trap

# Create test tasks first
create_test_tasks

echo "Starting Dependency Management tests..."
echo

# ===== DEPENDENCY MANAGEMENT =====
echo "=== Dependency Management ==="

# Test POST /api/tasks/:id/dependencies
echo "Testing POST /api/tasks/:id/dependencies..."
ADD_DEP_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tasks/$TASK_ID_2/dependencies" \
    -H "Content-Type: application/json" \
    -d "{\"dependsOn\":\"$TASK_ID_1\"}")
check_json_response "$ADD_DEP_RESPONSE" "success" "Add dependency"

# Verify dependency was added
echo "Verifying dependency was added..."
VERIFY_DEP_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/$TASK_ID_2")
if echo "$VERIFY_DEP_RESPONSE" | jq -e ".dependencies | contains([\"$TASK_ID_1\"])" >/dev/null 2>&1; then
    echo "✅ Dependency successfully added"
else
    echo "❌ Dependency not properly added"
    echo "Response: $VERIFY_DEP_RESPONSE"
fi

# Test GET /api/tasks/dependencies/validate
echo "Testing GET /api/tasks/dependencies/validate..."
VALIDATE_DEP_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/dependencies/validate")
check_json_response "$VALIDATE_DEP_RESPONSE" "isValid" "Validate dependencies"

# Show validation results
echo "Dependency validation results:"
if echo "$VALIDATE_DEP_RESPONSE" | jq -e '.isValid == true' >/dev/null 2>&1; then
    echo "✅ All dependencies are valid"
else
    echo "⚠️  Some dependency issues found:"
    echo "$VALIDATE_DEP_RESPONSE" | jq -r '.issues[]?' 2>/dev/null || echo "  (No specific issues listed)"
fi

# Create a circular dependency scenario for testing fix functionality
echo "Creating test scenario for dependency fixing..."
CREATE_RESPONSE_3=$(curl -s -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Dependency Test Task 3","priority":"medium"}')

if check_json_response "$CREATE_RESPONSE_3" "taskId" "Create task for dependency testing"; then
    TASK_ID_3=$(echo "$CREATE_RESPONSE_3" | jq -r '.taskId')
    CREATED_TASK_IDS+=("$TASK_ID_3")
    echo "  Created task ID: $TASK_ID_3"
    
    # Try to create a circular dependency (this should be handled gracefully)
    echo "Testing circular dependency handling..."
    CIRCULAR_DEP_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tasks/$TASK_ID_1/dependencies" \
        -H "Content-Type: application/json" \
        -d "{\"dependsOn\":\"$TASK_ID_3\"}")
    
    # Add dependency from task 3 to task 2 to complete potential circle
    curl -s -X POST "$SERVER_URL/api/tasks/$TASK_ID_3/dependencies" \
        -H "Content-Type: application/json" \
        -d "{\"dependsOn\":\"$TASK_ID_2\"}" >/dev/null 2>&1 || true
fi

# Test POST /api/tasks/dependencies/fix
echo "Testing POST /api/tasks/dependencies/fix..."
FIX_DEP_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tasks/dependencies/fix" \
    -H "Content-Type: application/json" \
    -d '{}')
check_json_response "$FIX_DEP_RESPONSE" "success" "Fix dependency issues"

# Validate dependencies after fix
echo "Validating dependencies after fix..."
VALIDATE_AFTER_FIX_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/dependencies/validate")
if echo "$VALIDATE_AFTER_FIX_RESPONSE" | jq -e '.isValid == true' >/dev/null 2>&1; then
    echo "✅ All dependencies are valid after fix"
else
    echo "⚠️  Some dependency issues remain after fix:"
    echo "$VALIDATE_AFTER_FIX_RESPONSE" | jq -r '.issues[]?' 2>/dev/null || echo "  (No specific issues listed)"
fi

# Test DELETE /api/tasks/:id/dependencies/:dependencyId
echo "Testing DELETE /api/tasks/:id/dependencies/:dependencyId..."
REMOVE_DEP_RESPONSE=$(curl -s -X DELETE "$SERVER_URL/api/tasks/$TASK_ID_2/dependencies/$TASK_ID_1")
check_json_response "$REMOVE_DEP_RESPONSE" "success" "Remove dependency"

# Verify dependency was removed
echo "Verifying dependency was removed..."
VERIFY_REMOVE_RESPONSE=$(curl -s "$SERVER_URL/api/tasks/$TASK_ID_2")
if echo "$VERIFY_REMOVE_RESPONSE" | jq -e ".dependencies | contains([\"$TASK_ID_1\"]) | not" >/dev/null 2>&1; then
    echo "✅ Dependency successfully removed"
else
    echo "❌ Dependency not properly removed"
    echo "Response: $VERIFY_REMOVE_RESPONSE"
fi

# Test error handling - try to add dependency to non-existent task
echo "Testing error handling with invalid dependency..."
INVALID_DEP_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/tasks/$TASK_ID_1/dependencies" \
    -H "Content-Type: application/json" \
    -d '{"dependsOn":"99999"}')

INVALID_STATUS_CODE="${INVALID_DEP_RESPONSE: -3}"
if [ "$INVALID_STATUS_CODE" -eq 400 ] || [ "$INVALID_STATUS_CODE" -eq 404 ]; then
    echo "✅ Invalid dependency correctly rejected (HTTP $INVALID_STATUS_CODE)"
else
    echo "❌ Invalid dependency not properly handled (HTTP $INVALID_STATUS_CODE)"
fi

echo

echo "🎉 DEPENDENCY MANAGEMENT TESTS COMPLETED!"
echo "✅ Tested 4 dependency management endpoints:"
echo "   ✅ POST /api/tasks/:id/dependencies (add dependency)"
echo "   ✅ GET /api/tasks/dependencies/validate (validate all dependencies)"
echo "   ✅ POST /api/tasks/dependencies/fix (fix dependency issues)"
echo "   ✅ DELETE /api/tasks/:id/dependencies/:dependencyId (remove dependency)"
echo "   ✅ Error handling for invalid dependencies" 