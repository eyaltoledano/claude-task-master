Break down a complex task into subtasks.

Arguments: $ARGUMENTS (task ID)

## Intelligent Task Expansion

Analyzes a task and creates detailed subtasks for better manageability.

## Execution

```bash
task-master expand --id=$ARGUMENTS
```

## Expansion Process

1. **Task Analysis**
   - Review task complexity
   - Identify components
   - Detect technical challenges
   - Estimate time requirements

2. **Subtask Generation**
   - Create 3-7 subtasks typically
   - Each subtask 1-4 hours
   - **Maximize independence**: only chain subtasks where output genuinely blocks input
   - Prefer parallel-ready subtasks to reduce the critical path
   - Clear acceptance criteria

3. **Smart Breakdown**
   - Setup/configuration (often a single shared prerequisite)
   - Core implementation components (identify which can run in parallel)
   - Testing components (can often run alongside implementation)
   - Integration steps (depends on implementation)
   - Documentation updates

## Enhanced Features

Based on task type:
- **Feature**: Setup → Implement → Test → Integrate
- **Bug Fix**: Reproduce → Diagnose → Fix → Verify
- **Refactor**: Analyze → Plan → Refactor → Validate

## Post-Expansion

After expansion:
1. Show subtask hierarchy with dependency graph
2. Identify which subtasks can run in parallel vs which must be sequential
3. Show critical path through subtasks (longest dependency chain by complexity)
4. If critical path equals total complexity, flag opportunities to make subtasks independent