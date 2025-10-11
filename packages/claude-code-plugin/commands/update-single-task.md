Update a single specific task with new information.

Arguments: $ARGUMENTS

Parse task ID and update details.

## Single Task Update

Precisely update one task with AI assistance to maintain consistency.

## Argument Parsing

Natural language updates:
- "5: add caching requirement"
- "update 5 to include error handling"
- "task 5 needs rate limiting"
- "5 change priority to high"

## Execution

```bash
task-master update-task --id=<id> --prompt="<context>"
```

## Update Types

### 1. **Content Updates**
- Enhance description
- Add requirements
- Clarify details
- Update acceptance criteria

### 2. **Metadata Updates**
- Change priority
- Adjust time estimates
- Update complexity
- Modify dependencies

### 3. **Strategic Updates**
- Revise approach
- Change test strategy
- Update implementation notes
- Adjust subtask needs

## AI-Powered Updates

The AI:
1. **Understands Context**
   - Reads current task state
   - Identifies update intent
   - Maintains consistency
   - Preserves important info

2. **Applies Changes**
   - Updates relevant fields
   - Keeps style consistent
   - Adds without removing
   - Enhances clarity

3. **Validates Results**
   - Checks coherence
   - Verifies completeness
   - Maintains relationships
   - Suggests related updates

## Example Updates

```
/taskmaster:update/single 5: add rate limiting
→ Updating Task #5: "Implement API endpoints"

Current: Basic CRUD endpoints
Adding: Rate limiting requirements

Updated sections:
✓ Description: Added rate limiting mention
✓ Details: Added specific limits (100/min)
✓ Test Strategy: Added rate limit tests
✓ Complexity: Increased from 5 to 6
✓ Time Estimate: Increased by 2 hours

Suggestion: Also update task #6 (API Gateway) for consistency?
```

## Smart Features

1. **Incremental Updates**
   - Adds without overwriting
   - Preserves work history
   - Tracks what changed
   - Shows diff view

2. **Consistency Checks**
   - Related task alignment
   - Subtask compatibility
   - Dependency validity
   - Timeline impact

3. **Update History**
   - Timestamp changes
   - Track who/what updated
   - Reason for update
   - Previous versions

## Field-Specific Updates

Quick syntax for specific fields:
- "5 priority:high" → Update priority only
- "5 add-time:4h" → Add to time estimate
- "5 status:review" → Change status
- "5 depends:3,4" → Add dependencies

## Post-Update

- Show updated task
- Highlight changes
- Check related tasks
- Update suggestions
- Timeline adjustments