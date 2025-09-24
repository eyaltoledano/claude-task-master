Execute a pipeline of commands based on a specification.

Arguments: $ARGUMENTS

## Command Pipeline Execution

Parse pipeline specification from arguments. Supported formats:

### Simple Pipeline
`init → expand-all → sprint-plan`

### Conditional Pipeline  
`status → if:pending>10 → sprint-plan → else → next`

### Iterative Pipeline
`for:pending-tasks → expand → complexity-check`

### Smart Pipeline Patterns

**1. Project Setup Pipeline**
```
init [prd] → 
expand-all → 
complexity-report → 
sprint-plan → 
show first-sprint
```

**2. Daily Work Pipeline**
```
standup →
if:in-progress → continue →
else → next → start
```

**3. Task Completion Pipeline**
```
complete [id] →
git-commit →
if:blocked-tasks-freed → show-freed →
next
```

**4. Quality Check Pipeline**
```
list in-progress →
for:each → check-idle-time →
if:idle>1day → prompt-update
```

### Pipeline Features

**Variables**
- Store results: `status → $count=pending-count`
- Use in conditions: `if:$count>10`
- Pass between commands: `expand $high-priority-tasks`

**Error Handling**
- On failure: `try:complete → catch:show-blockers`
- Skip on error: `optional:test-run`
- Retry logic: `retry:3:commit`

**Parallel Execution**
- Parallel branches: `[analyze | test | lint]`
- Join results: `parallel → join:report`

### Execution Flow

1. Parse pipeline specification
2. Validate command sequence
3. Execute with state passing
4. Handle conditions and loops
5. Aggregate results
6. Show summary

This enables complex workflows like:
`parse-prd → expand-all → filter:complex>70 → assign:senior → sprint-plan:weighted`