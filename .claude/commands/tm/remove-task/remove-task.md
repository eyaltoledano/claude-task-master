Remove a task permanently from the project.

Arguments: $ARGUMENTS (task ID)

Delete a task and handle all its relationships properly.

## Task Removal

Permanently removes a task while maintaining project integrity.

## Argument Parsing

- "remove task 5"
- "delete 5"
- "5" → remove task 5
- Can include "-y" for auto-confirm

## Execution

```bash
task-master remove-task --id=<id> [-y]
```

## Pre-Removal Analysis

1. **Task Details**
   - Current status
   - Work completed
   - Time invested
   - Associated data

2. **Relationship Check**
   - Tasks that depend on this
   - Dependencies this task has
   - Subtasks that will be removed
   - Blocking implications

3. **Impact Assessment**
   ```
   Task Removal Impact
   ━━━━━━━━━━━━━━━━━━
   Task: #5 "Implement authentication" (in-progress)
   Status: 60% complete (~8 hours work)
   
   Will affect:
   - 3 tasks depend on this (will be blocked)
   - Has 4 subtasks (will be deleted)
   - Part of critical path
   
   ⚠️  This action cannot be undone
   ```

## Smart Warnings

- Warn if task is in-progress
- Show dependent tasks that will be blocked
- Highlight if part of critical path
- Note any completed work being lost

## Removal Process

1. Show comprehensive impact
2. Require confirmation (unless -y)
3. Update dependent task references
4. Remove task and subtasks
5. Clean up orphaned dependencies
6. Log removal with timestamp

## Alternative Actions

Suggest before deletion:
- Mark as cancelled instead
- Convert to documentation
- Archive task data
- Transfer work to another task

## Post-Removal

- List affected tasks
- Show broken dependencies
- Update project statistics
- Suggest dependency fixes
- Recalculate timeline

## Example Flows

```
/project:tm/remove-task 5
→ Task #5 is in-progress with 8 hours logged
→ 3 other tasks depend on this
→ Suggestion: Mark as cancelled instead?
Remove anyway? (y/n)

/project:tm/remove-task 5 -y
→ Removed: Task #5 and 4 subtasks
→ Updated: 3 task dependencies
→ Warning: Tasks #7, #8, #9 now have missing dependency
→ Run /project:tm/fix-dependencies to resolve
```

## Safety Features

- Confirmation required
- Impact preview
- Removal logging
- Suggest alternatives
- No cascade delete of dependents