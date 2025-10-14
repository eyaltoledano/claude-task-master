Convert an existing task into a subtask.

Arguments: $ARGUMENTS

Parse parent ID and task ID to convert.

## Task Conversion

Converts an existing standalone task into a subtask of another task.

## Argument Parsing

- "move task 8 under 5"
- "make 8 a subtask of 5"
- "nest 8 in 5"
- "5 8" → make task 8 a subtask of task 5

## Execution

```bash
task-master add-subtask --parent=<parent-id> --task-id=<task-to-convert>
```

## Pre-Conversion Checks

1. **Validation**
   - Both tasks exist and are valid
   - No circular parent relationships
   - Task isn't already a subtask
   - Logical hierarchy makes sense

2. **Impact Analysis**
   - Dependencies that will be affected
   - Tasks that depend on converting task
   - Priority alignment needed
   - Status compatibility

## Conversion Process

1. Change task ID from "8" to "5.1" (next available)
2. Update all dependency references
3. Inherit parent's context where appropriate
4. Adjust priorities if needed
5. Update time estimates

## Smart Features

- Preserve task history
- Maintain dependencies
- Update all references
- Create conversion log

## Example

```
/taskmaster:add-subtask/from-task 5 8
→ Converting: Task #8 becomes subtask #5.1
→ Updated: 3 dependency references
→ Parent task #5 now has 1 subtask
→ Note: Subtask inherits parent's priority

Before: #8 "Implement validation" (standalone)
After:  #5.1 "Implement validation" (subtask of #5)
```

## Post-Conversion

- Show new task hierarchy
- List updated dependencies
- Verify project integrity
- Suggest related conversions