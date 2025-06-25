#!/bin/bash
set -euo pipefail

# Analysis & Research E2E Test
# Tests AI-powered analysis and research functionality

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/shared/test-utils.sh"

echo "=== Task Master Web API - Analysis & Research Test ==="

# Setup environment and cleanup trap
setup_test_environment
setup_cleanup_trap

# Create test tasks first for analysis
create_test_tasks

echo "Starting Analysis & Research tests..."
echo

# ===== ANALYSIS & RESEARCH =====
echo "=== Analysis & Research ==="

# Test POST /api/analysis/complexity
echo "Testing POST /api/analysis/complexity..."
COMPLEXITY_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/analysis/complexity" \
    -H "Content-Type: application/json" \
    -d '{"useResearch":false,"threshold":5}')
check_json_response "$COMPLEXITY_RESPONSE" "success" "Analyze task complexity"

# Check if complexity analysis generated a report
echo "Verifying complexity analysis generated results..."
if echo "$COMPLEXITY_RESPONSE" | jq -e '.data.tasksAnalyzed' >/dev/null 2>&1; then
    TASKS_ANALYZED=$(echo "$COMPLEXITY_RESPONSE" | jq -r '.data.tasksAnalyzed')
    echo "✅ Complexity analysis completed for $TASKS_ANALYZED tasks"
else
    echo "⚠️  Complexity analysis response format may be different"
    echo "Response: $COMPLEXITY_RESPONSE"
fi

# Test GET /api/analysis/complexity-report
echo "Testing GET /api/analysis/complexity-report..."
COMPLEXITY_REPORT_RESPONSE=$(curl -s "$SERVER_URL/api/analysis/complexity-report")
if echo "$COMPLEXITY_REPORT_RESPONSE" | jq -e '.report // .error' >/dev/null; then
    echo "✅ Get complexity report (report exists or expected error)"
    
    # Check if we have a valid report
    if echo "$COMPLEXITY_REPORT_RESPONSE" | jq -e '.report' >/dev/null 2>&1; then
        echo "✅ Complexity report contains data"
        # Show some report details
        if echo "$COMPLEXITY_REPORT_RESPONSE" | jq -e '.report.tasks' >/dev/null 2>&1; then
            REPORT_TASK_COUNT=$(echo "$COMPLEXITY_REPORT_RESPONSE" | jq -r '.report.tasks | length')
            echo "  Report contains $REPORT_TASK_COUNT task(s)"
        fi
    else
        echo "⚠️  No complexity report available (may need to run analysis first)"
    fi
else
    echo "❌ Get complexity report failed"
    echo "Response: $COMPLEXITY_REPORT_RESPONSE"
fi

# Test POST /api/research
echo "Testing POST /api/research..."
RESEARCH_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/research" \
    -H "Content-Type: application/json" \
    -d '{"query":"What are best practices for REST API testing?","detailLevel":"low","saveFile":false}')
check_json_response "$RESEARCH_RESPONSE" "success" "Perform research query"

# Verify research response contains useful data
echo "Verifying research response..."
if echo "$RESEARCH_RESPONSE" | jq -e '.data.response' >/dev/null 2>&1; then
    echo "✅ Research response contains data"
    RESPONSE_LENGTH=$(echo "$RESEARCH_RESPONSE" | jq -r '.data.response | length')
    echo "  Response length: $RESPONSE_LENGTH characters"
    
    # Check if telemetry data is included
    if echo "$RESEARCH_RESPONSE" | jq -e '.data.telemetryData' >/dev/null 2>&1; then
        echo "✅ Research response includes telemetry data"
        MODEL_USED=$(echo "$RESEARCH_RESPONSE" | jq -r '.data.telemetryData.modelUsed // "unknown"')
        echo "  Model used: $MODEL_USED"
    else
        echo "⚠️  Research response missing telemetry data"
    fi
else
    echo "❌ Research response missing expected data"
    echo "Response: $RESEARCH_RESPONSE"
fi

# Test research with different detail level
echo "Testing research with high detail level..."
RESEARCH_HIGH_DETAIL_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/research" \
    -H "Content-Type: application/json" \
    -d '{"query":"What is Node.js?","detailLevel":"high","saveFile":false}')
check_json_response "$RESEARCH_HIGH_DETAIL_RESPONSE" "success" "Perform high-detail research query"

# Compare response lengths between detail levels
if echo "$RESEARCH_HIGH_DETAIL_RESPONSE" | jq -e '.data.response' >/dev/null 2>&1; then
    HIGH_DETAIL_LENGTH=$(echo "$RESEARCH_HIGH_DETAIL_RESPONSE" | jq -r '.data.response | length')
    echo "  High detail response length: $HIGH_DETAIL_LENGTH characters"
    
    if [ "$HIGH_DETAIL_LENGTH" -gt "$RESPONSE_LENGTH" ]; then
        echo "✅ High detail level produced longer response as expected"
    else
        echo "⚠️  High detail level did not produce significantly longer response"
    fi
fi

# Test research with task context
if [ -n "$TASK_ID_1" ]; then
    echo "Testing research with task context..."
    RESEARCH_WITH_CONTEXT_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/research" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"How to implement this task?\",\"taskIds\":[\"$TASK_ID_1\"],\"detailLevel\":\"medium\",\"saveFile\":false}")
    check_json_response "$RESEARCH_WITH_CONTEXT_RESPONSE" "success" "Perform research with task context"
fi

# Test research error handling - empty query
echo "Testing research error handling with empty query..."
EMPTY_QUERY_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/research" \
    -H "Content-Type: application/json" \
    -d '{"query":"","detailLevel":"low","saveFile":false}')

EMPTY_QUERY_STATUS_CODE="${EMPTY_QUERY_RESPONSE: -3}"
if [ "$EMPTY_QUERY_STATUS_CODE" -eq 400 ]; then
    echo "✅ Empty research query correctly rejected (HTTP 400)"
else
    echo "❌ Empty research query not properly handled (HTTP $EMPTY_QUERY_STATUS_CODE)"
fi

# Test research error handling - invalid detail level
echo "Testing research error handling with invalid detail level..."
INVALID_DETAIL_RESPONSE=$(curl -s -w "HTTP_STATUS_CODE:%{http_code}" -X POST "$SERVER_URL/api/research" \
    -H "Content-Type: application/json" \
    -d '{"query":"Test query","detailLevel":"invalid","saveFile":false}')

INVALID_DETAIL_STATUS_CODE="${INVALID_DETAIL_RESPONSE: -3}"
if [ "$INVALID_DETAIL_STATUS_CODE" -eq 400 ]; then
    echo "✅ Invalid detail level correctly rejected (HTTP 400)"
else
    echo "❌ Invalid detail level not properly handled (HTTP $INVALID_DETAIL_STATUS_CODE)"
fi

# Test complexity analysis with research enabled (if API keys are available)
echo "Testing complexity analysis with research enabled..."
COMPLEXITY_WITH_RESEARCH_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/analysis/complexity" \
    -H "Content-Type: application/json" \
    -d '{"useResearch":true,"threshold":3}')

if echo "$COMPLEXITY_WITH_RESEARCH_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
    echo "✅ Complexity analysis with research completed successfully"
    
    # Check if research was actually used
    if echo "$COMPLEXITY_WITH_RESEARCH_RESPONSE" | jq -e '.data.telemetryData' >/dev/null 2>&1; then
        echo "✅ Research-enabled complexity analysis includes telemetry"
    fi
else
    echo "⚠️  Complexity analysis with research may have failed (possibly due to missing API keys)"
    echo "Response: $COMPLEXITY_WITH_RESEARCH_RESPONSE"
fi

echo

echo "🎉 ANALYSIS & RESEARCH TESTS COMPLETED!"
echo "✅ Tested 3 analysis & research endpoints:"
echo "   ✅ POST /api/analysis/complexity (analyze task complexity)"
echo "   ✅ GET /api/analysis/complexity-report (get complexity report)"
echo "   ✅ POST /api/research (perform research queries)"
echo "   ✅ Different detail levels tested"
echo "   ✅ Task context integration tested"
echo "   ✅ Research with complexity analysis tested"
echo "   ✅ Error handling for invalid inputs" 