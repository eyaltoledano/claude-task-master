Add a dependency between tasks.

Arguments: $ARGUMENTS

Parse the task IDs to establish dependency relationship.

## Adding Dependencies

Creates a dependency where one task must be completed before another can start.

## Argument Parsing

Parse natural language or IDs:
- "make 5 depend on 3" → task 5 depends on task 3
- "5 needs 3" → task 5 depends on task 3
- "5 3" → task 5 depends on task 3
- "5 after 3" → task 5 depends on task 3

## Execution

```bash
task-master add-dependency --id=<task-id> --depends-on=<dependency-id>
```

## Validation

Before adding:
1. **Verify both tasks exist**
2. **Check for circular dependencies**
3. **Ensure dependency makes logical sense**
4. **Warn if creating complex chains**

## Smart Features

- Detect if dependency already exists
- Suggest related dependencies
- Show impact on task flow
- Update task priorities if needed

## Post-Addition

After adding dependency:
1. Show updated dependency graph
2. Identify any newly blocked tasks
3. Suggest task order changes
4. Update project timeline

## Example Flows

```
/project:tm/add-dependency 5 needs 3
→ Task #5 now depends on Task #3
→ Task #5 is now blocked until #3 completes
→ Suggested: Also consider if #5 needs #4
```