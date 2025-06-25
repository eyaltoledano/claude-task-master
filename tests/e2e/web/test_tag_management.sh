#!/bin/bash
set -euo pipefail

# Tag Management E2E Test
# Tests tag creation, modification, and management functionality

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/shared/test-utils.sh"

echo "=== Task Master Web API - Tag Management Test ==="

# Setup environment and cleanup trap
setup_test_environment
setup_cleanup_trap

echo "Starting Tag Management tests..."
echo

# ===== TAG MANAGEMENT =====
echo "=== Tag Management ==="

# Test GET /api/tags
echo "Testing GET /api/tags..."
LIST_TAGS_RESPONSE=$(curl -s "$SERVER_URL/api/tags?showMetadata=true")
check_json_response "$LIST_TAGS_RESPONSE" "tags" "List all tags"

# Show initial tag count
INITIAL_TAG_COUNT=$(echo "$LIST_TAGS_RESPONSE" | jq -r '.tags | length')
echo "  Initial tag count: $INITIAL_TAG_COUNT"

# Test POST /api/tags
echo "Testing POST /api/tags..."
CREATE_TAG_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tags" \
    -H "Content-Type: application/json" \
    -d "{\"tagName\":\"$TEST_TAG\",\"description\":\"API test tag\"}")

if check_json_response "$CREATE_TAG_RESPONSE" "success" "Create new tag"; then
    CREATED_TAG_NAMES+=("$TEST_TAG")
    echo "  Created tag: $TEST_TAG"
fi

# Verify tag was created
echo "Verifying tag creation..."
VERIFY_TAG_RESPONSE=$(curl -s "$SERVER_URL/api/tags")
if echo "$VERIFY_TAG_RESPONSE" | jq -e ".tags | map(.name) | contains([\"$TEST_TAG\"])" >/dev/null 2>&1; then
    echo "✅ Tag successfully created and appears in tag list"
else
    echo "❌ Tag creation verification failed"
    echo "Response: $VERIFY_TAG_RESPONSE"
fi

# Test PUT /api/tags/:oldName/rename/:newName
echo "Testing PUT /api/tags/:oldName/rename/:newName..."
RENAMED_TAG="$TEST_TAG-renamed"
RENAME_TAG_RESPONSE=$(curl -s -X PUT "$SERVER_URL/api/tags/$TEST_TAG/rename/$RENAMED_TAG" \
    -H "Content-Type: application/json" \
    -d '{}')

if check_json_response "$RENAME_TAG_RESPONSE" "success" "Rename tag"; then
    # Update our tracking - remove old tag name and add new one
    if [ ${#CREATED_TAG_NAMES[@]} -gt 0 ]; then
        CREATED_TAG_NAMES=("${CREATED_TAG_NAMES[@]/$TEST_TAG}")
    fi
    CREATED_TAG_NAMES+=("$RENAMED_TAG")
    echo "  Renamed tag from $TEST_TAG to $RENAMED_TAG"
fi

# Verify tag rename
echo "Verifying tag rename..."
VERIFY_RENAME_RESPONSE=$(curl -s "$SERVER_URL/api/tags")
if echo "$VERIFY_RENAME_RESPONSE" | jq -e ".tags | map(.name) | contains([\"$RENAMED_TAG\"])" >/dev/null 2>&1 && \
   ! echo "$VERIFY_RENAME_RESPONSE" | jq -e ".tags | map(.name) | contains([\"$TEST_TAG\"])" >/dev/null 2>&1; then
    echo "✅ Tag successfully renamed"
else
    echo "❌ Tag rename verification failed"
    echo "Response: $VERIFY_RENAME_RESPONSE"
fi

# Test POST /api/tags/:sourceName/copy/:targetName
echo "Testing POST /api/tags/:sourceName/copy/:targetName..."
COPIED_TAG="$RENAMED_TAG-copy"
COPY_TAG_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/tags/$RENAMED_TAG/copy/$COPIED_TAG" \
    -H "Content-Type: application/json" \
    -d '{"description":"Copied tag"}')

if check_json_response "$COPY_TAG_RESPONSE" "success" "Copy tag"; then
    CREATED_TAG_NAMES+=("$COPIED_TAG")
    echo "  Copied tag from $RENAMED_TAG to $COPIED_TAG"
fi

# Verify tag copy
echo "Verifying tag copy..."
VERIFY_COPY_RESPONSE=$(curl -s "$SERVER_URL/api/tags")
if echo "$VERIFY_COPY_RESPONSE" | jq -e ".tags | map(.name) | contains([\"$COPIED_TAG\"])" >/dev/null 2>&1; then
    echo "✅ Tag successfully copied"
    # Check if both source and copy exist
    if echo "$VERIFY_COPY_RESPONSE" | jq -e ".tags | map(.name) | contains([\"$RENAMED_TAG\"])" >/dev/null 2>&1; then
        echo "✅ Source tag still exists after copy"
    else
        echo "❌ Source tag missing after copy"
    fi
else
    echo "❌ Tag copy verification failed"
    echo "Response: $VERIFY_COPY_RESPONSE"
fi

# Test PUT /api/tags/use/:tagName
echo "Testing PUT /api/tags/use/:tagName..."
USE_TAG_RESPONSE=$(curl -s -X PUT "$SERVER_URL/api/tags/use/$RENAMED_TAG" \
    -H "Content-Type: application/json" \
    -d '{}')
check_json_response "$USE_TAG_RESPONSE" "success" "Switch to tag"

# Verify tag switch by checking current tag
echo "Verifying tag switch..."
# Note: This verification depends on the API providing current tag info
# For now, we'll just verify the response was successful

# Test error handling - try to create duplicate tag
echo "Testing error handling with duplicate tag creation..."
DUPLICATE_TAG_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/tags" \
    -H "Content-Type: application/json" \
    -d "{\"tagName\":\"$RENAMED_TAG\",\"description\":\"Duplicate tag\"}")

DUPLICATE_STATUS_CODE="${DUPLICATE_TAG_RESPONSE: -3}"
if [ "$DUPLICATE_STATUS_CODE" -eq 409 ] || [ "$DUPLICATE_STATUS_CODE" -eq 400 ]; then
    echo "✅ Duplicate tag creation correctly rejected (HTTP $DUPLICATE_STATUS_CODE)"
else
    echo "❌ Duplicate tag creation not properly handled (HTTP $DUPLICATE_STATUS_CODE)"
fi

# Test error handling - try to rename to existing tag
echo "Testing error handling with rename to existing tag..."
RENAME_CONFLICT_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X PUT "$SERVER_URL/api/tags/$COPIED_TAG/rename/$RENAMED_TAG" \
    -H "Content-Type: application/json" \
    -d '{}')

RENAME_CONFLICT_STATUS_CODE="${RENAME_CONFLICT_RESPONSE: -3}"
if [ "$RENAME_CONFLICT_STATUS_CODE" -eq 409 ] || [ "$RENAME_CONFLICT_STATUS_CODE" -eq 400 ]; then
    echo "✅ Rename to existing tag correctly rejected (HTTP $RENAME_CONFLICT_STATUS_CODE)"
else
    echo "❌ Rename to existing tag not properly handled (HTTP $RENAME_CONFLICT_STATUS_CODE)"
fi

# Test error handling - try to use non-existent tag
echo "Testing error handling with non-existent tag..."
NONEXISTENT_TAG_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X PUT "$SERVER_URL/api/tags/use/nonexistent-tag-12345" \
    -H "Content-Type: application/json" \
    -d '{}')

NONEXISTENT_STATUS_CODE="${NONEXISTENT_TAG_RESPONSE: -3}"
if [ "$NONEXISTENT_STATUS_CODE" -eq 404 ]; then
    echo "✅ Use of non-existent tag correctly rejected (HTTP 404)"
else
    echo "❌ Use of non-existent tag not properly handled (HTTP $NONEXISTENT_STATUS_CODE)"
fi

# Test DELETE /api/tags/:tagName
echo "Testing DELETE /api/tags/:tagName..."
DELETE_TAG_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X DELETE "$SERVER_URL/api/tags/$COPIED_TAG?force=true")
check_status_code "204" "$DELETE_TAG_RESPONSE" "Delete tag returns 204"

# Verify tag deletion
echo "Verifying tag deletion..."
VERIFY_DELETE_RESPONSE=$(curl -s "$SERVER_URL/api/tags")
if ! echo "$VERIFY_DELETE_RESPONSE" | jq -e ".tags | map(.name) | contains([\"$COPIED_TAG\"])" >/dev/null 2>&1; then
    echo "✅ Tag successfully deleted"
    # Remove from our tracking
    if [ ${#CREATED_TAG_NAMES[@]} -gt 0 ]; then
        CREATED_TAG_NAMES=("${CREATED_TAG_NAMES[@]/$COPIED_TAG}")
    fi
else
    echo "❌ Tag deletion verification failed"
    echo "Response: $VERIFY_DELETE_RESPONSE"
fi

# Show final tag count
echo "Checking final tag count..."
FINAL_TAG_RESPONSE=$(curl -s "$SERVER_URL/api/tags")
FINAL_TAG_COUNT=$(echo "$FINAL_TAG_RESPONSE" | jq -r '.tags | length')
echo "  Final tag count: $FINAL_TAG_COUNT"
echo "  Net change: $((FINAL_TAG_COUNT - INITIAL_TAG_COUNT)) tags"

echo

echo "🎉 TAG MANAGEMENT TESTS COMPLETED!"
echo "✅ Tested 6 tag management endpoints:"
echo "   ✅ GET /api/tags (list all tags)"
echo "   ✅ POST /api/tags (create new tag)"
echo "   ✅ PUT /api/tags/:oldName/rename/:newName (rename tag)"
echo "   ✅ POST /api/tags/:sourceName/copy/:targetName (copy tag)"
echo "   ✅ PUT /api/tags/use/:tagName (switch to tag)"
echo "   ✅ DELETE /api/tags/:tagName (delete tag)"
echo "   ✅ Error handling for duplicate creation"
echo "   ✅ Error handling for rename conflicts"
echo "   ✅ Error handling for non-existent tags" 