Defer a task for later consideration.

Arguments: $ARGUMENTS (task ID)

## Deferring a Task

This status indicates a task is valid but not currently actionable or prioritized.

## Valid Reasons for Deferral

- Waiting for external dependencies
- Reprioritized for future sprint
- Blocked by technical limitations
- Resource constraints
- Strategic timing considerations

## Execution

```bash
task-master set-status --id=$ARGUMENTS --status=deferred
```

## Deferral Management

When deferring:
1. **Document Reason**
   - Capture why it's being deferred
   - Set reactivation criteria
   - Note any partial work completed

2. **Impact Analysis**
   - Check dependent tasks
   - Update project timeline
   - Notify affected stakeholders

3. **Future Planning**
   - Set review reminders
   - Tag for specific milestone
   - Preserve context for reactivation
   - Link to blocking issues

## Smart Tracking

- Monitor deferral duration
- Alert when criteria met
- Prevent scope creep
- Regular review cycles