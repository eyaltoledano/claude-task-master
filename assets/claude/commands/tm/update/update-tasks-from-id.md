Update multiple tasks starting from a specific ID.

Arguments: $ARGUMENTS

Parse starting task ID and update context.

## Bulk Task Updates

Update multiple related tasks based on new requirements or context changes.

## Argument Parsing

- "from 5: add security requirements"
- "5 onwards: update API endpoints"
- "starting at 5: change to use new framework"

## Execution

```bash
task-master update --from=<id> --prompt="<context>"
```

## Update Process

### 1. **Task Selection**
Starting from specified ID:
- Include the task itself
- Include all dependent tasks
- Include related subtasks
- Smart boundary detection

### 2. **Context Application**
AI analyzes the update context and:
- Identifies what needs changing
- Maintains consistency
- Preserves completed work
- Updates related information

### 3. **Intelligent Updates**
- Modify descriptions appropriately
- Update test strategies
- Adjust time estimates
- Revise dependencies if needed

## Smart Features

1. **Scope Detection**
   - Find natural task groupings
   - Identify related features
   - Stop at logical boundaries
   - Avoid over-updating

2. **Consistency Maintenance**
   - Keep naming conventions
   - Preserve relationships
   - Update cross-references
   - Maintain task flow

3. **Change Preview**
   ```
   Bulk Update Preview
   ━━━━━━━━━━━━━━━━━━
   Starting from: Task #5
   Tasks to update: 8 tasks + 12 subtasks
   
   Context: "add security requirements"
   
   Changes will include:
   - Add security sections to descriptions
   - Update test strategies for security
   - Add security-related subtasks where needed
   - Adjust time estimates (+20% average)
   
   Continue? (y/n)
   ```

## Example Updates

```
/project:tm/update/from-id 5: change database to PostgreSQL
→ Analyzing impact starting from task #5
→ Found 6 related tasks to update
→ Updates will maintain consistency
→ Preview changes? (y/n)

Applied updates:
✓ Task #5: Updated connection logic references
✓ Task #6: Changed migration approach
✓ Task #7: Updated query syntax notes
✓ Task #8: Revised testing strategy
✓ Task #9: Updated deployment steps
✓ Task #12: Changed backup procedures
```

## Safety Features

- Preview all changes
- Selective confirmation
- Rollback capability
- Change logging
- Validation checks

## Post-Update

- Summary of changes
- Consistency verification
- Suggest review tasks
- Update timeline if needed