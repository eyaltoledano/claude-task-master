# Task Master Testing Guide

This guide provides comprehensive testing procedures to ensure both streaming and non-streaming functionality work correctly with the new token tracking implementation.

## 📄 Test Data

The test script uses the sample PRD file located at `tests/fixtures/sample-prd.txt` which contains a comprehensive task management app specification with multiple features and requirements. This ensures consistent testing across all modes and provides a realistic PRD for validation.

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

### 1. Basic Functionality Tests

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

### 2. Detailed Progress Analysis

```bash
# Test progress accuracy and timing
node parse-prd-analysis.js accuracy

# Test different PRD complexities
node parse-prd-analysis.js complexity

# Run all detailed tests
node parse-prd-analysis.js all
```

### 3. Unit and Integration Tests

```bash
# Run all Jest tests
npm test

# Run specific test suites
npm test -- --testNamePattern="parse-prd"
npm test -- --testNamePattern="streaming"
```

## 📋 Testing Checklist

### ✅ **Streaming Functionality Tests**

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

**CLI Checklist:**
- [ ] `task-master parse-prd` works without errors
- [ ] Tasks.json file created with correct structure
- [ ] Individual task files (task_001.txt, etc.) generated
- [ ] Task list command shows generated tasks
- [ ] No streaming progress (CLI doesn't provide progress reporter)
- [ ] Telemetry displayed at completion

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

### **Streaming Success Indicators:**
- ✅ Initial message shows input token count
- ✅ Progress updates appear every 4-8 seconds with priority indicators (🔴🔴🔴🟠🟠⚪🟢⚪⚪)
- ✅ Each task shows estimated output tokens
- ✅ Progress percentages increase monotonically
- ✅ Final completion shows total I/O tokens and cost
- ✅ No JSON parsing errors (or graceful fallback if they occur)

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

# MCP Progress Compliance Testing Guide

This section provides comprehensive testing procedures to ensure MCP progress implementation is fully compliant with the MCP 2025-03-26 specification and FastMCP requirements.

## 🎯 **MCP Progress Specification Compliance**

### **Key Requirements from MCP Spec 2025-03-26:**
1. **Progress values MUST increase** with each notification
2. **Total value MUST remain consistent** throughout operation
3. **Progress messages SHOULD** provide relevant human-readable information
4. **Progress notifications MUST stop** after completion
5. **Progress tokens** handled by FastMCP framework automatically

### **FastMCP Integration Requirements:**
1. **Function validation**: Check `reportProgress` is a function
2. **Graceful degradation**: Work when progress not available
3. **Context passing**: Thread through all layers correctly
4. **Error handling**: Progress errors don't break main operation

## 📋 **MCP Progress Testing Checklist**

### ✅ **Progress Specification Compliance**

**Progress Values Always Increase:**
- [ ] Initial progress starts at 0
- [ ] Each task completion increments by 1
- [ ] Progress never decreases (even during fallback parsing)
- [ ] Final progress equals total at completion
- [ ] Setup phases can maintain same progress with different messages

**Consistent Total Values:**
- [ ] Total set to `numTasks` at start and never changes
- [ ] All progress reports use same total value
- [ ] No dynamic total adjustments during operation

**Meaningful Messages with Token Tracking:**
- [ ] Initial: `"Starting PRD analysis (Input: 2,150 tokens) with research..."`
- [ ] Tasks: `"🔴 Task 1/8 - Set up project structure | ~Output: 340 tokens"`
- [ ] Completion: `"✅ Task Generation Completed | Tokens (I/O): 2,150/1,847 ($0.0423)"`

**Progress Completion:**
- [ ] Final progress report sent at 100% completion
- [ ] No additional progress reports after completion
- [ ] Operation terminates cleanly after final report

### ✅ **FastMCP Integration Compliance**

**Function Validation:**
- [ ] Checks `typeof reportProgress === 'function'`
- [ ] Logs warning when progress not available
- [ ] Passes `undefined` when function not provided

**Context Threading:**
- [ ] MCP tool receives `reportProgress` in context
- [ ] Direct function passes progress to core logic
- [ ] Core logic validates and uses progress function

**Error Handling:**
- [ ] Progress errors caught with `.catch()`
- [ ] Errors logged but don't break main operation
- [ ] Operation continues successfully even with progress failures

## 🔍 **Expected Progress Flow with Token Tracking**

### **Expected Output Examples:**

**MCP Streaming Mode (numTasks = 3):**
```
Progress: "Starting PRD analysis (Input: 1,250 tokens) with research..."
Progress: "🔴 Task 1/3 - Set up project structure | ~Output: 180 tokens"
Progress: "🔴 Task 2/3 - Implement user authentication | ~Output: 340 tokens"
Progress: "🟠 Task 3/3 - Design database schema | ~Output: 280 tokens"
Progress: "✅ Task Generation Completed | Tokens (I/O): 1,250/800 ($0.0234)"
```

**CLI Streaming Mode (numTasks = 3):**
```
🤖 Parsing PRD and Generating Tasks
📊 Starting PRD analysis (Input: 1,250 tokens) with research...
▓▓▓▓▓▓▓▓▒▒▒▒▒▒ 33% | Task 1/3 - Set up project structure
▓▓▓▓▓▓▓▓▓▓▓▒▒▒ 67% | Task 2/3 - Implement user authentication  
▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100% | Task 3/3 - Design database schema
✅ Task Generation Completed | Tokens (I/O): 1,250/800 ($0.0234)
```

**Non-Streaming Mode (numTasks = 3):**
```
🤖 Parsing PRD and Generating Tasks
[processing without progress updates]
✅ Task Generation Completed | Tokens (I/O): 1,250/800 ($0.0234)
```

### **Key Validation Points:**

1. **Progress Values**: Monotonically increasing based on completed tasks
2. **Token Tracking**: Input shown at start, output tracked during generation
3. **Priority Display**: Task messages show priority with color indicators
4. **Cost Calculation**: Final message includes accurate cost estimate
5. **Completion Indicator**: Final message has ✅ symbol and summary

## 🧪 **MCP-Specific Testing (`node test-parse-prd.js mcp-streaming`)**

The MCP streaming test mode specifically validates the proper MCP context and priority indicator handling:

### **What the MCP Streaming Test Validates:**
- ✅ **MCP Context Detection**: Verifies `isMCP = true` when `mcpLog` is provided
- ✅ **Emoji Priority Indicators**: Confirms emoji indicators (🔴🟠🟢) are used instead of CLI dots (●●●)
- ✅ **MCP Logging**: Tests that MCP logger receives debug messages
- ✅ **Progress Format**: Validates MCP-specific progress message format
- ✅ **Telemetry Data**: Ensures telemetry data flows through MCP layers correctly

### **Expected MCP Streaming Test Output:**
```bash
🧪 Testing MCP Streaming Functionality

Starting MCP streaming test...
[DEBUG] Parsing PRD file: /path/to/test-prd.txt, Force: true, Append: false, Research: false
[DEBUG] Reading PRD content from /path/to/test-prd.txt
[1ms] 0% Starting PRD analysis (Input: 1303 tokens)...
[DEBUG] Calling streaming AI service to generate tasks from PRD...
[9759ms] 20% 🔴 Task 1/5 - Setup Project Infrastructure | ~Output: 88 tokens
[17104ms] 40% 🔴 Task 2/5 - Implement Core Task Management | ~Output: 173 tokens
[24021ms] 60% 🔴 Task 3/5 - Implement Real-time Collaboration | ~Output: 252 tokens
[31792ms] 80% 🟠 Task 4/5 - Build File Upload System | ~Output: 337 tokens
[39943ms] 100% 🟠 Task 5/5 - Create User Dashboard | ~Output: 429 tokens
[41583ms] 100% ✅ Task Generation Completed | ~Tokens (I/O): 1303/2196

=== MCP-Specific Validation ===
✅ Emoji priority indicators: PASS

✅ Tasks file created with 5 tasks
✅ Task structure is valid
```

### **Key Differences from CLI Streaming Test:**
- **Priority Indicators**: Uses 🔴🟠🟢 (MCP) instead of ●●● (CLI)
- **MCP Logging**: Includes debug logs from MCP logger
- **Context Validation**: Specifically tests `isMCP = true` path
- **Telemetry Flow**: Validates telemetry data through MCP layers

### **Running MCP Streaming Test with Different Task Counts:**
```bash
# Test with 3 tasks (quick test)
node test-parse-prd.js mcp-streaming 3

# Test with 8 tasks (standard test)
node test-parse-prd.js mcp-streaming 8

# Test with 10 tasks (comprehensive test)
node test-parse-prd.js mcp-streaming 10
```

## 🧪 **Available Test Files**

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

### **Unit Tests:**
- **`tests/unit/parse-prd-streaming.test.js`**: Jest unit tests for streaming functionality
- **`tests/unit/scripts/modules/task-manager/parse-prd.test.js`**: Core logic unit tests

## 🎯 **Success Criteria - PERFECT Implementation**

**✅ All tests pass when:**
- Token tracking displays correctly at all stages
- Progress values are always monotonically increasing
- Priority indicators (🔴🔴🔴🟠🟠⚪🟢⚪⚪) display correctly
- Messages follow exact format with token information
- Final completion message includes cost and token summary
- Function validation works correctly
- Error handling doesn't break main operation
- MCP integration follows FastMCP patterns
- CLI mode gracefully works without progress
- Performance stays within acceptable bounds

## 🔧 **Debugging Common Issues**

### **Token Tracking Not Working:**
```bash
# Check if estimateTokens function is working
# Verify telemetry data is being passed through
# Look for token counts in progress messages
```

### **Progress Format Issues:**
```bash
# Verify priority indicators are showing (🔴🔴🔴🟠🟠⚪🟢⚪⚪)
# Check token format: "~Output: 340 tokens"
# Ensure completion format: "Tokens (I/O): 2,150/1,847 ($0.0423)"
```

### **Missing Progress Updates:**
```bash
# Verify JSON parser onValue callback is firing
# Check for complete tasks with valid titles
# Ensure no errors are preventing progress reports
```

---

## 📁 **Test File Organization**

The test files in this directory have been renamed for clarity:

- **`test-parse-prd.js`** (formerly `test-streaming-prd.js`)
  - Comprehensive integration tests for all parse-prd modes
  - Tests MCP streaming, CLI streaming, and non-streaming functionality
  - Validates token tracking and message formats across contexts

- **`parse-prd-analysis.js`** (formerly `test-progress-detailed.js`)  
  - Detailed timing and accuracy analysis for progress reporting
  - Tests different PRD complexities and validates real-time characteristics
  - Focuses specifically on progress behavior and performance metrics

---

This testing guide ensures both streaming and non-streaming functionality work correctly with the new token tracking implementation across all integration points and edge cases. 