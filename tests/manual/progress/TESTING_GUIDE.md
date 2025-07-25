# Task Master Progress Testing Guide

Quick reference for testing streaming/non-streaming functionality with token tracking.

## 🎯 Test Modes

1. **MCP Streaming** - Has `reportProgress` + `mcpLog`, shows emoji indicators (🔴🟠🟢)
2. **CLI Streaming** - No `reportProgress`, shows terminal progress bars  
3. **Non-Streaming** - No progress reporting, single response

## 🚀 Quick Commands

```bash
# Test Scripts (accept: mcp-streaming, cli-streaming, non-streaming, both, all)
node test-parse-prd.js [mode] 
node test-analyze-complexity.js [mode]
node test-expand.js [mode] [num_subtasks]
node test-expand-all.js [mode] [num_subtasks]
node parse-prd-analysis.js [accuracy|complexity|all]

# CLI Commands
node scripts/dev.js parse-prd test.txt         # Local dev (streaming)
node scripts/dev.js analyze-complexity --research
node scripts/dev.js expand --id=1 --force
node scripts/dev.js expand --all --force

task-master [command]                          # Global CLI (non-streaming)
```

## ✅ Success Indicators

### Indicators
- **Priority**: 🔴🔴🔴 (high), 🟠🟠⚪ (medium), 🟢⚪⚪ (low)
- **Complexity**: ●●● (7-10), ●●○ (4-6), ●○○ (1-3)

### Token Format
`Tokens (I/O): 2,150/1,847 ($0.0423)` (~4 chars per token)

### Progress Bars
```
Single:  Generating subtasks... |████████░░| 80% (4/5)
Dual:    Expanding 3 tasks | Task 2/3 |████████░░| 66%
         Generating 5 subtasks... |██████░░░░| 60%
```

### Fractional Progress
`(completedTasks + currentSubtask/totalSubtasks) / totalTasks`
Example: 33% → 46% → 60% → 66% → 80% → 93% → 100%

## 🐛 Quick Fixes

| Issue | Fix |
|-------|-----|
| No streaming | Check `reportProgress` is passed |
| NaN% progress | Filter duplicate `subtask_progress` events |
| Missing tokens | Check `.env` has API keys |
| Broken bars | Terminal width > 80 |
| projectRoot.split | Use `projectRoot` not `session` |

```bash
# Debug
TASKMASTER_DEBUG=true node test-expand.js
npm run lint
```

## 📊 Benchmarks
- Single task: 10-20s (5 subtasks)
- Expand all: 30-45s (3 tasks)
- Streaming: ~10-20% faster
- Updates: Every 2-5s

## 🔄 Test Workflow

```bash
# Quick check
node test-parse-prd.js both && npm test

# Full suite (before release)
for test in parse-prd analyze-complexity expand expand-all; do
  node test-$test.js all
done
node parse-prd-analysis.js all
npm test
```

## 🎯 MCP Tool Example

```javascript
{
  "tool": "parse_prd",
  "args": {
    "input": "prd.txt",
    "numTasks": "8", 
    "force": true,
    "projectRoot": "/path/to/project"
  }
}
