# Task Master Testing Guide

This guide provides comprehensive testing procedures to ensure both streaming and non-streaming functionality work correctly with the new token tracking implementation across Task Master features.

## 📄 Test Data

### Parse-PRD Testing
The test script uses the sample PRD file located at `tests/fixtures/sample-prd.txt` which contains a comprehensive task management app specification with multiple features and requirements. This ensures consistent testing across all modes and provides a realistic PRD for validation.

### Analyze-Complexity Testing
The analyze-complexity tests use the existing tasks in `.taskmaster/tasks/tasks.json` or create test tasks if none exist. This provides realistic complexity analysis scenarios with actual task data.

## 🎯 Understanding Test Modes

Task Master supports three distinct test modes for parse-prd functionality:

### **MCP Streaming Mode (`mcp-streaming`)**
- **Context**: MCP server with proper MCP context (`mcpLog` provided) and `reportProgress` callback
- **Behavior**: Uses `streamText` service with real-time JSON parsing and MCP-specific priority indicators
- **Progress**: Sends progress notifications via MCP with emoji indicators (🔴🟠🟢)
- **Output Format**: JSON responses for MCP clients
- **UI**: Clean progress messages with emoji priority indicators, MCP logging
- **Priority Indicators**: Uses `getPriorityIndicators(isMCP=true)` for emoji-based indicators

### **CLI Streaming Mode (`cli-streaming`)**  
- **Context**: CLI context without `reportProgress` callback
- **Behavior**: Uses `streamText` service but displays CLI progress bars
- **Progress**: Shows colored terminal progress bars and indicators
- **Output Format**: Text responses with chalk styling
- **UI**: Full CLI experience with boxed summaries and colored output
- **Priority Indicators**: Uses `getPriorityIndicators(isMCP=false)` for CLI dot-based indicators

### **Non-Streaming Mode (`non-streaming`)**
- **Context**: Any context without real-time progress requirements
- **Behavior**: Uses `generateObjectService` for single response
- **Progress**: No progress reporting during operation
- **Output Format**: Based on context (JSON for MCP, text for CLI)
- **UI**: Only shows final results with telemetry

## 🚀 Quick Start Testing

### 1. Parse-PRD Functionality Tests

```bash
# Test MCP streaming functionality (with proper MCP context and emoji indicators)
node test-parse-prd.js mcp-streaming

# Test CLI streaming functionality (no reportProgress, but with progress bars)
node test-parse-prd.js cli-streaming

# Test non-streaming functionality (no progress reporting at all)
node test-parse-prd.js non-streaming

# Test both MCP streaming and non-streaming modes and compare results
node test-parse-prd.js both

# Test all three modes (MCP streaming, CLI streaming, non-streaming)
node test-parse-prd.js all
```

### 2. Analyze-Complexity Functionality Tests

```bash
# Test MCP streaming functionality (with proper MCP context and dot indicators)
node test-analyze-complexity.js mcp-streaming

# Test CLI streaming functionality (no reportProgress, but with progress bars)
node test-analyze-complexity.js cli-streaming

# Test non-streaming functionality (no progress reporting at all)
node test-analyze-complexity.js non-streaming

# Test both MCP streaming and non-streaming modes and compare results
node test-analyze-complexity.js both

# Test all three modes (MCP streaming, CLI streaming, non-streaming)
node test-analyze-complexity.js all

# Test analyze-complexity CLI streaming (recommended - uses local dev version)
node scripts/dev.js analyze-complexity --research

# Test analyze-complexity CLI streaming without research
node scripts/dev.js analyze-complexity

# Test analyze-complexity with specific threshold
node scripts/dev.js analyze-complexity --threshold=7 --research

# Test analyze-complexity with specific task range
node scripts/dev.js analyze-complexity --from=1 --to=3 --research

# Test analyze-complexity with specific task IDs
node scripts/dev.js analyze-complexity --id=1,3,5 --research

# Test global CLI version (non-streaming by default)
task-master analyze-complexity --research

# Verify results
task-master complexity-report
ls .taskmaster/reports/task-complexity-report.json
```

### 3. Detailed Progress Analysis

```bash
# Test progress accuracy and timing
node parse-prd-analysis.js accuracy

# Test different PRD complexities
node parse-prd-analysis.js complexity

# Run all detailed tests
node parse-prd-analysis.js all
```

### 4. Unit and Integration Tests

```bash
# Run all Jest tests
npm test

# Run specific test suites
npm test -- --testNamePattern="parse-prd"
npm test -- --testNamePattern="streaming"
npm test -- --testNamePattern="analyze-complexity"
```

## 📋 Testing Checklist

### ✅ **Parse-PRD Streaming Functionality Tests**

**Auto-Detection:**
- [ ] Streaming enabled when `reportProgress` function provided
- [ ] Progress updates sent in real-time as tasks are parsed
- [ ] No configuration files required

**Token Tracking Progress Reporting:**
- [ ] Initial progress shows input tokens: `"Starting PRD analysis (Input: 2,150 tokens) with research..."`
- [ ] Task progress shows priority indicators and output tokens: `"🔴🔴🔴 Task 1/10 - Setup Project Repository | ~Output: 340 tokens"`
- [ ] Final completion shows total tokens and cost: `"✅ Task Generation Completed | Tokens (I/O): 2,150/1,847 ($0.0423)"`
- [ ] Progress is monotonically increasing
- [ ] Token estimates are reasonable (~4 chars per token)

**Priority Indicators:**
- [ ] 🔴🔴🔴 High priority tasks displayed correctly
- [ ] 🟠🟠⚪ Medium priority tasks displayed correctly  
- [ ] 🟢⚪⚪ Low priority tasks displayed correctly

**JSON Streaming:**
- [ ] Streaming JSON parser works correctly
- [ ] Fallback JSON parsing works if streaming fails
- [ ] Tasks are parsed incrementally from AI stream
- [ ] Final task count matches expected number

**Error Handling:**
- [ ] Graceful handling of JSON parsing errors
- [ ] Progress reporting errors don't break main flow
- [ ] AI service errors are properly caught and reported

### ✅ **Analyze-Complexity Streaming Functionality Tests**

**Auto-Detection:**
- [ ] Streaming enabled when `progressTracker` is true in CLI mode
- [ ] Progress updates sent in real-time as tasks are analyzed
- [ ] Uses existing tasks.json file or creates test tasks

**Token Tracking Progress Reporting:**
- [ ] Initial progress shows input tokens and analysis start
- [ ] Task progress shows complexity score, subtasks count, and priority indicators: `●●○ Task 1 (Score: 5, Subtasks: 5): Setup Project...`
- [ ] Final completion shows total tokens and cost in telemetry box
- [ ] Progress bar shows real-time completion: `Analysis 5/5 |████████████████████████████████████████| 100%`
- [ ] Token estimates are reasonable and tracked during analysis

**Priority Indicators:**
- [ ] ●●● High complexity tasks (scores 8-10) displayed correctly
- [ ] ●●○ Medium complexity tasks (scores 4-7) displayed correctly  
- [ ] ●○○ Low complexity tasks (scores 1-3) displayed correctly

**Complexity Analysis:**
- [ ] Complexity scores range from 1-10 and are reasonable
- [ ] Subtask recommendations correlate with complexity scores
- [ ] Task titles are properly truncated if too long
- [ ] Analysis results are saved to complexity report file

**Error Handling:**
- [ ] Graceful handling of missing tasks file
- [ ] Progress reporting errors don't break main analysis
- [ ] AI service errors are properly caught and reported
- [ ] Invalid task data is handled gracefully

### ✅ **Non-Streaming Functionality Tests**

**Auto-Detection:**
- [ ] Non-streaming used when no `reportProgress` function provided
- [ ] Traditional `generateObjectService` path used
- [ ] No progress updates sent

**Output Quality:**
- [ ] Same task quality as streaming version
- [ ] Proper UI formatting (boxes, colors, telemetry)
- [ ] Task files generated correctly
- [ ] Dependencies validated and fixed

**Performance:**
- [ ] Reasonable completion time
- [ ] Memory usage within expected bounds
- [ ] No memory leaks or hanging processes

### ✅ **CLI Integration Tests**

#### Parse-PRD CLI Tests
```bash
# Test CLI parse-prd command (non-streaming by default)
echo "# Test PRD
Build a simple todo app with React and Node.js.
Features: user auth, CRUD tasks, real-time updates.
Tech: React frontend, Node.js backend, PostgreSQL database." > test-prd.txt

task-master parse-prd test-prd.txt --num-tasks=5 --force

# Verify results
task-master list
ls task_*.txt

# Clean up
rm test-prd.txt tasks.json task_*.txt
```

**Parse-PRD CLI Checklist:**
- [ ] `task-master parse-prd` works without errors
- [ ] Tasks.json file created with correct structure
- [ ] Individual task files (task_001.txt, etc.) generated
- [ ] Task list command shows generated tasks
- [ ] No streaming progress (CLI doesn't provide progress reporter)
- [ ] Telemetry displayed at completion

#### Analyze-Complexity CLI Tests
```bash
# Test CLI analyze-complexity command with streaming (using local dev version)
node scripts/dev.js analyze-complexity --research

# Test with different options
node scripts/dev.js analyze-complexity --threshold=7 --research
node scripts/dev.js analyze-complexity --from=1 --to=3
node scripts/dev.js analyze-complexity --id=1,3,5 --research

# Test global CLI version (non-streaming by default)
task-master analyze-complexity --research

# Verify results
task-master complexity-report
ls .taskmaster/reports/task-complexity-report.json
```

**Analyze-Complexity CLI Checklist:**
- [ ] `node scripts/dev.js analyze-complexity` shows streaming progress
- [ ] Progress bar displays real-time analysis completion
- [ ] Individual task analysis shown with priority indicators
- [ ] Complexity report file created with correct structure
- [ ] `task-master complexity-report` displays formatted results
- [ ] Token tracking and telemetry displayed at completion
- [ ] Different options (--threshold, --from, --to, --id) work correctly

### ✅ **MCP Integration Tests**

**If you have Cursor or another MCP client:**

```javascript
// Test parse_prd MCP tool
{
  "tool": "parse_prd",
  "args": {
    "input": ".taskmaster/docs/prd.txt",
    "numTasks": "8",
    "force": true,
    "research": false,
    "projectRoot": "/path/to/your/project"
  }
}

// Test analyze_project_complexity MCP tool
{
  "tool": "analyze_project_complexity",
  "args": {
    "threshold": 5,
    "research": true,
    "projectRoot": "/path/to/your/project"
  }
}
```

**MCP Checklist:**
- [ ] MCP tool accepts progress token from client
- [ ] Streaming enabled when progress token provided
- [ ] Progress notifications sent via MCP protocol with token tracking
- [ ] Final result includes telemetry data
- [ ] Error responses properly formatted

### ✅ **Edge Case Tests**

**Empty/Invalid PRD:**
```bash
# Test empty PRD
echo "" > empty-prd.txt
node test-parse-prd.js streaming  # Should handle gracefully

# Test invalid PRD
echo "This is not a valid PRD" > invalid-prd.txt
# Modify test to use invalid-prd.txt
```

**Network/AI Failures:**
- [ ] Graceful handling of AI service timeouts
- [ ] Proper error messages for API key issues
- [ ] Fallback behavior when streaming fails

**File System Issues:**
- [ ] Handles read-only directories
- [ ] Manages disk space issues
- [ ] Proper cleanup on failures

## 🔍 **What to Look For**

### **Parse-PRD Streaming Success Indicators:**
- ✅ Initial message shows input token count
- ✅ Progress updates appear every 4-8 seconds with priority indicators (🔴🔴🔴🟠🟠⚪🟢⚪⚪)
- ✅ Each task shows estimated output tokens
- ✅ Progress percentages increase monotonically
- ✅ Final completion shows total I/O tokens and cost
- ✅ No JSON parsing errors (or graceful fallback if they occur)

### **Analyze-Complexity Streaming Success Indicators:**
- ✅ Progress bar shows real-time analysis: `Analysis 5/5 |████████████████████████████████████████| 100%`
- ✅ Individual task analysis displayed as it happens with priority indicators (●●●, ●●○, ●○○)
- ✅ Task format: `●●○ Task 1 (Score: 5, Subtasks: 5): Setup Project Structure and HTML Foundation`
- ✅ Complexity scores range from 1-10 with appropriate priority indicators
- ✅ Subtask recommendations based on complexity scores
- ✅ Token tracking during analysis: `Tokens (I/O): 0/770`
- ✅ Final telemetry summary with cost calculation

### **Non-Streaming Success Indicators:**
- ✅ Single completion message after AI finishes
- ✅ Telemetry box displayed with cost/token information
- ✅ "Next Steps" suggestions box shown
- ✅ Same task quality and structure as streaming version

### **Token Tracking Success Indicators:**
- ✅ Input tokens estimated at start (~4 chars per token)
- ✅ Output tokens tracked during streaming
- ✅ Final token counts and cost calculation accurate
- ✅ Token display format consistent: `Tokens (I/O): 2,150/1,847 ($0.0423)`

### **Performance Benchmarks:**
- **Streaming:** Usually 30-60 seconds for 8 tasks
- **Non-streaming:** Usually 30-60 seconds for 8 tasks
- **Progress Updates:** Every 4-8 seconds during generation
- **Memory Usage:** Should remain stable throughout

## 🐛 **Troubleshooting Common Issues**

### **Streaming Not Working:**
```bash
# Check if progress reporter is being passed
# Look for this in logs: "Auto-detect streaming based on whether progress reporting is provided"
# Should see: "useStreaming = true" in debug output
```

### **Token Tracking Issues:**
```bash
# Verify token estimation function is working
# Check for proper telemetry data in AI service responses
# Ensure cost calculations are reasonable
```

### **Progress Updates Missing:**
```bash
# Verify the parser.onValue callback is firing
# Check for JSON parsing errors in output
# Ensure AI response contains valid JSON structure
```

### **Performance Issues:**
```bash
# Check API key configuration
# Verify network connectivity
# Monitor memory usage during long operations
```

### **JSON Parsing Errors:**
```bash
# These are often normal and handled by fallback parsing
# Look for "Fallback JSON parsing" in logs
# Final result should still be successful
```

## 📊 **Performance Testing**

### **Load Testing:**
```bash
# Test multiple concurrent operations
for i in {1..3}; do
  node test-parse-prd.js streaming &
done
wait
```

### **Memory Testing:**
```bash
# Monitor memory usage during operation
node --max-old-space-size=512 test-parse-prd.js streaming
```

### **Timing Analysis:**
```bash
# Get detailed timing breakdown
node parse-prd-analysis.js accuracy
```

## 🎯 **Success Criteria**

**All tests pass when:**
- ✅ Both streaming and non-streaming produce equivalent task quality
- ✅ Token tracking displays correctly throughout the process
- ✅ Progress updates are sent in real-time during streaming with priority indicators
- ✅ Auto-detection correctly chooses streaming vs non-streaming
- ✅ Error handling is graceful and informative
- ✅ Performance is within acceptable bounds (< 2 minutes for 8 tasks)
- ✅ Memory usage remains stable
- ✅ CLI and MCP integrations work correctly
- ✅ Task files are generated with proper structure and content
- ✅ Telemetry data is accurate and properly displayed

## 🔄 **Continuous Testing**

**Before commits:**
```bash
# Quick verification
node test-parse-prd.js both

# Unit tests
npm test
```

**Before releases:**
```bash
# Comprehensive testing
node test-parse-prd.js all
node parse-prd-analysis.js all
npm test
# Manual CLI testing
# Manual MCP testing (if available)
```

---

## 📚 **Test File Reference**

### **Integration Tests:**
- **`test-parse-prd.js`**: Comprehensive integration test with real AI calls
  - **MCP Streaming Mode (`mcp-streaming`)**: Tests with proper MCP context (`mcpLog`) and `reportProgress` callback, validates emoji progress indicators (🔴🟠🟢)
  - **CLI Streaming Mode (`cli-streaming`)**: Tests without `reportProgress`, validates CLI progress bars and styling with CLI dot indicators (●●●)
  - **Non-Streaming Mode (`non-streaming`)**: Tests traditional generateObject path with no progress reporting
  - **Token Tracking**: Validates input/output token estimation and cost calculation across all modes
  - **Message Format**: Validates specific message formats for each context (MCP vs CLI)
  - **Performance Comparison**: Compares execution times between different modes
  - **Test Modes**: `mcp-streaming`, `cli-streaming`, `non-streaming`, `both`, `all`

### **Progress Analysis:**
- **`parse-prd-analysis.js`**: Detailed timing and accuracy analysis for streaming modes
  - **Accuracy Testing**: Validates progress values are monotonically increasing
  - **Complexity Testing**: Tests with different PRD complexities (simple=3 tasks, medium=6 tasks, complex=10 tasks)
  - **Timing Analysis**: Measures progress reporting intervals and real-time characteristics
  - **Progress Validation**: Ensures consistent progress values and meaningful messages
  - **Real-time Metrics**: Analyzes whether progress updates occur in reasonable time intervals (< 10s)
  - **Test Modes**: `accuracy`, `complexity`, `all`

- **`test-analyze-complexity.js`**: Comprehensive integration test with real AI calls for analyze-complexity functionality
  - **MCP Streaming Mode (`mcp-streaming`)**: Tests with proper MCP context (`mcpLog`) and `reportProgress` callback, validates dot progress indicators (●●●)
  - **CLI Streaming Mode (`cli-streaming`)**: Tests without `reportProgress`, validates CLI progress bars and styling
  - **Non-Streaming Mode (`non-streaming`)**: Tests traditional generateText path with no progress reporting
  - **Token Tracking**: Validates input/output token estimation and cost calculation across all modes
  - **Message Format**: Validates specific message formats for complexity analysis (Score, Subtasks, Priority indicators)
  - **Performance Comparison**: Compares execution times between different modes
  - **Test Modes**: `mcp-streaming`, `cli-streaming`, `non-streaming`, `both`, `all`

### **Unit Tests:**
- **`tests/unit/parse-prd-streaming.test.js`**: Jest unit tests for parse-prd streaming functionality
- **`tests/unit/scripts/modules/task-manager/parse-prd.test.js`**: Core logic unit tests for parse-prd
- **`tests/unit/scripts/modules/task-manager/analyze-task-complexity.test.js`**: Core logic unit tests for analyze-complexity

---

# MCP Progress Compliance Testing Guide

This section provides specific guidance for testing MCP progress reporting compliance to ensure consistent behavior across different MCP clients.

## Progress Reporting Requirements

### **Message Format Standards:**
- **Initial Progress**: `"Starting [operation] analysis (Input: N tokens)..."`
- **Task Progress**: `"[indicator] Task X/Y - [title] | ~Output: N tokens"`
- **Final Progress**: `"✅ [Operation] Completed | Tokens (I/O): X/Y | Cost: $N.NNNN"`

### **Progress Value Requirements:**
- Values must be monotonically increasing
- Progress should only be reported for complete items
- Total should remain constant throughout operation
- Final progress value should equal total

### **Token Tracking Requirements:**
- Input tokens estimated at start (~4 characters per token)
- Output tokens tracked during streaming
- Cost calculation based on provider pricing
- Final telemetry includes accurate token counts

## Testing MCP Compliance

```bash
# Test MCP streaming with progress reporting
node test-parse-prd.js mcp-streaming

# Verify progress messages follow MCP format
# Check for emoji indicators in MCP mode
# Validate token tracking accuracy
```

**MCP Compliance Checklist:**
- [ ] Progress values are monotonically increasing
- [ ] Messages include proper priority indicators
- [ ] Token tracking is accurate and consistent
- [ ] Error handling doesn't break progress flow
- [ ] Final result includes complete telemetry data 