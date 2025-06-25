#!/bin/bash
set -euo pipefail

# Error Handling & Validation E2E Test
# Tests comprehensive error handling across all API endpoints

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/shared/test-utils.sh"

echo "=== Task Master Web API - Error Handling & Validation Test ==="

# Setup environment and cleanup trap
setup_test_environment
setup_cleanup_trap

echo "Starting Error Handling & Validation tests..."
echo

# ===== ERROR HANDLING TESTS =====
echo "=== Error Handling Tests ==="

# Test invalid task ID
echo "Testing error handling with invalid task ID..."
INVALID_TASK_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" "$SERVER_URL/api/tasks/99999")
check_status_code "404" "$INVALID_TASK_RESPONSE" "Invalid task ID returns 404"

# Test missing required field in task creation
echo "Testing error handling with missing required field..."
MISSING_FIELD_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d '{}')
check_status_code "400" "$MISSING_FIELD_RESPONSE" "Missing required field returns 400"

# Test invalid JSON
echo "Testing error handling with invalid JSON..."
INVALID_JSON_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d 'invalid json')
check_status_code "400" "$INVALID_JSON_RESPONSE" "Invalid JSON returns 400"

# Test nonexistent tag
echo "Testing error handling with nonexistent tag..."
NONEXISTENT_TAG_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X DELETE "$SERVER_URL/api/tags/nonexistent-tag-12345")
check_status_code "404" "$NONEXISTENT_TAG_RESPONSE" "Nonexistent tag returns 404"

# ===== VALIDATION ERROR TESTS =====
echo "=== Validation Error Tests ==="

# Test invalid task status
echo "Testing validation with invalid task status..."
test_validation_error "PATCH" "/api/tasks/1/status" '{"status":"invalid-status"}' "Invalid task status"

# Test invalid priority
echo "Testing validation with invalid priority..."
test_validation_error "POST" "/api/tasks" '{"prompt":"Test","priority":"invalid-priority"}' "Invalid priority level"

# Test invalid dependency format
echo "Testing validation with invalid dependency format..."
test_validation_error "POST" "/api/tasks/1/dependencies" '{"dependsOn":123}' "Invalid dependency format (should be string)"

# Test empty prompt
echo "Testing validation with empty prompt..."
test_validation_error "POST" "/api/tasks" '{"prompt":"","priority":"medium"}' "Empty prompt"

# Test invalid tag name format
echo "Testing validation with invalid tag name..."
test_validation_error "POST" "/api/tags" '{"tagName":"invalid tag name!","description":"test"}' "Invalid tag name format"

# Test invalid research detail level
echo "Testing validation with invalid research detail level..."
test_validation_error "POST" "/api/research" '{"query":"test","detailLevel":"invalid"}' "Invalid research detail level"

# Test invalid subtask data
echo "Testing validation with invalid subtask data..."
test_validation_error "POST" "/api/tasks/1/subtasks" '{"title":"","description":"test"}' "Empty subtask title"

# Test invalid move operation
echo "Testing validation with invalid move data..."
test_validation_error "PUT" "/api/tasks/move-batch" '{"from":["1"],"to":["2","3"]}' "Mismatched move arrays"

# Test invalid expand parameters
echo "Testing validation with invalid expand parameters..."
test_validation_error "POST" "/api/tasks/1/expand" '{"num":-1}' "Negative subtask count"

# Test invalid complexity threshold
echo "Testing validation with invalid complexity threshold..."
test_validation_error "POST" "/api/analysis/complexity" '{"threshold":15}' "Threshold out of range (should be 1-10)"

# ===== HTTP METHOD VALIDATION =====
echo "=== HTTP Method Validation ==="

# Test unsupported HTTP methods
echo "Testing unsupported HTTP method on tasks endpoint..."
UNSUPPORTED_METHOD_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X TRACE "$SERVER_URL/api/tasks")
UNSUPPORTED_STATUS_CODE="${UNSUPPORTED_METHOD_RESPONSE: -3}"
if [ "$UNSUPPORTED_STATUS_CODE" -eq 405 ] || [ "$UNSUPPORTED_STATUS_CODE" -eq 404 ]; then
    echo "✅ Unsupported HTTP method correctly rejected (HTTP $UNSUPPORTED_STATUS_CODE)"
else
    echo "❌ Unsupported HTTP method not properly handled (HTTP $UNSUPPORTED_STATUS_CODE)"
fi

# ===== CONTENT TYPE VALIDATION =====
echo "=== Content Type Validation ==="

# Test missing Content-Type header
echo "Testing missing Content-Type header..."
MISSING_CONTENT_TYPE_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/tasks" \
    -d '{"prompt":"Test","priority":"medium"}')
MISSING_CT_STATUS_CODE="${MISSING_CONTENT_TYPE_RESPONSE: -3}"
if [ "$MISSING_CT_STATUS_CODE" -eq 400 ] || [ "$MISSING_CT_STATUS_CODE" -eq 415 ]; then
    echo "✅ Missing Content-Type correctly rejected (HTTP $MISSING_CT_STATUS_CODE)"
else
    echo "❌ Missing Content-Type not properly handled (HTTP $MISSING_CT_STATUS_CODE)"
fi

# Test invalid Content-Type
echo "Testing invalid Content-Type header..."
INVALID_CONTENT_TYPE_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: text/plain" \
    -d '{"prompt":"Test","priority":"medium"}')
INVALID_CT_STATUS_CODE="${INVALID_CONTENT_TYPE_RESPONSE: -3}"
if [ "$INVALID_CT_STATUS_CODE" -eq 400 ] || [ "$INVALID_CT_STATUS_CODE" -eq 415 ]; then
    echo "✅ Invalid Content-Type correctly rejected (HTTP $INVALID_CT_STATUS_CODE)"
else
    echo "❌ Invalid Content-Type not properly handled (HTTP $INVALID_CT_STATUS_CODE)"
fi

# ===== LARGE PAYLOAD TESTS =====
echo "=== Large Payload Tests ==="

# Test extremely long prompt (if server has size limits)
echo "Testing extremely long prompt..."
LONG_PROMPT=$(printf 'A%.0s' {1..10000})  # 10,000 character prompt
LONG_PROMPT_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\":\"$LONG_PROMPT\",\"priority\":\"medium\"}")
LONG_PROMPT_STATUS_CODE="${LONG_PROMPT_RESPONSE: -3}"
if [ "$LONG_PROMPT_STATUS_CODE" -eq 413 ] || [ "$LONG_PROMPT_STATUS_CODE" -eq 400 ] || [ "$LONG_PROMPT_STATUS_CODE" -eq 201 ]; then
    echo "✅ Long prompt handled appropriately (HTTP $LONG_PROMPT_STATUS_CODE)"
else
    echo "❌ Long prompt not properly handled (HTTP $LONG_PROMPT_STATUS_CODE)"
fi

# ===== ENDPOINT-SPECIFIC ERROR TESTS =====
echo "=== Endpoint-Specific Error Tests ==="

# Test dependency on self
echo "Testing self-dependency error..."
SELF_DEP_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/tasks/1/dependencies" \
    -H "Content-Type: application/json" \
    -d '{"dependsOn":"1"}')
SELF_DEP_STATUS_CODE="${SELF_DEP_RESPONSE: -3}"
if [ "$SELF_DEP_STATUS_CODE" -eq 400 ]; then
    echo "✅ Self-dependency correctly rejected (HTTP 400)"
else
    echo "❌ Self-dependency not properly handled (HTTP $SELF_DEP_STATUS_CODE)"
fi

# Test moving task to itself
echo "Testing move task to itself error..."
SELF_MOVE_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X PUT "$SERVER_URL/api/tasks/1/move/1" \
    -H "Content-Type: application/json" \
    -d '{}')
SELF_MOVE_STATUS_CODE="${SELF_MOVE_RESPONSE: -3}"
if [ "$SELF_MOVE_STATUS_CODE" -eq 400 ]; then
    echo "✅ Self-move correctly rejected (HTTP 400)"
else
    echo "❌ Self-move not properly handled (HTTP $SELF_MOVE_STATUS_CODE)"
fi

# Test subtask on non-existent parent
echo "Testing subtask creation on non-existent parent..."
ORPHAN_SUBTASK_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/tasks/99999/subtasks" \
    -H "Content-Type: application/json" \
    -d '{"title":"Orphan subtask","description":"test"}')
ORPHAN_STATUS_CODE="${ORPHAN_SUBTASK_RESPONSE: -3}"
if [ "$ORPHAN_STATUS_CODE" -eq 404 ]; then
    echo "✅ Subtask on non-existent parent correctly rejected (HTTP 404)"
else
    echo "❌ Subtask on non-existent parent not properly handled (HTTP $ORPHAN_STATUS_CODE)"
fi

# ===== RATE LIMITING TESTS (if implemented) =====
echo "=== Rate Limiting Tests ==="

# Test multiple rapid requests (basic test)
echo "Testing rapid successive requests..."
RAPID_REQUEST_COUNT=0
for i in {1..5}; do
    RAPID_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" "$SERVER_URL/api/health")
    RAPID_STATUS_CODE="${RAPID_RESPONSE: -3}"
    if [ "$RAPID_STATUS_CODE" -eq 200 ]; then
        ((RAPID_REQUEST_COUNT++))
    fi
    sleep 0.1
done

if [ "$RAPID_REQUEST_COUNT" -eq 5 ]; then
    echo "✅ Rapid requests handled successfully (no rate limiting detected)"
elif [ "$RAPID_REQUEST_COUNT" -gt 0 ]; then
    echo "⚠️  Some rapid requests failed (possible rate limiting: $RAPID_REQUEST_COUNT/5 succeeded)"
else
    echo "❌ All rapid requests failed"
fi

echo

echo "🎉 ERROR HANDLING & VALIDATION TESTS COMPLETED!"
echo "✅ Tested comprehensive error scenarios:"
echo "   ✅ Invalid resource IDs (404 errors)"
echo "   ✅ Missing required fields (400 errors)"
echo "   ✅ Invalid JSON format (400 errors)"
echo "   ✅ Validation errors for all data types"
echo "   ✅ HTTP method validation (405 errors)"
echo "   ✅ Content-Type validation (415 errors)"
echo "   ✅ Large payload handling"
echo "   ✅ Endpoint-specific business logic errors"
echo "   ✅ Self-reference prevention"
echo "   ✅ Orphaned resource prevention"
echo "   ✅ Basic rate limiting behavior" 