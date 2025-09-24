Clear all subtasks from a specific task.

Arguments: $ARGUMENTS (task ID)

Remove all subtasks from a parent task at once.

## Clearing Subtasks

Bulk removal of all subtasks from a parent task.

## Execution

```bash
task-master clear-subtasks --id=<task-id>
```

## Pre-Clear Analysis

1. **Subtask Summary**
   - Number of subtasks
   - Completion status of each
   - Work already done
   - Dependencies affected

2. **Impact Assessment**
   - Data that will be lost
   - Dependencies to be removed
   - Effect on project timeline
   - Parent task implications

## Confirmation Required

```
Clear Subtasks Confirmation
━━━━━━━━━━━━━━━━━━━━━━━━━
Parent Task: #5 "Implement user authentication"
Subtasks to remove: 4
- #5.1 "Setup auth framework" (done)
- #5.2 "Create login form" (in-progress)
- #5.3 "Add validation" (pending)
- #5.4 "Write tests" (pending)

⚠️  This will permanently delete all subtask data
Continue? (y/n)
```

## Smart Features

- Option to convert to standalone tasks
- Backup task data before clearing
- Preserve completed work history
- Update parent task appropriately

## Process

1. List all subtasks for confirmation
2. Check for in-progress work
3. Remove all subtasks
4. Update parent task
5. Clean up dependencies

## Alternative Options

Suggest alternatives:
- Convert important subtasks to tasks
- Keep completed subtasks
- Archive instead of delete
- Export subtask data first

## Post-Clear

- Show updated parent task
- Recalculate time estimates
- Update task complexity
- Suggest next steps

## Example

```
/project:tm/clear-subtasks 5
→ Found 4 subtasks to remove
→ Warning: Subtask #5.2 is in-progress
→ Cleared all subtasks from task #5
→ Updated parent task estimates
→ Suggestion: Consider re-expanding with better breakdown
```