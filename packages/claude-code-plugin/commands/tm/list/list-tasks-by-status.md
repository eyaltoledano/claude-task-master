List tasks filtered by a specific status.

Arguments: $ARGUMENTS

Parse the status from arguments and list only tasks matching that status.

## Status Options
- `pending` - Not yet started
- `in-progress` - Currently being worked on
- `done` - Completed
- `review` - Awaiting review
- `deferred` - Postponed
- `cancelled` - Cancelled

## Execution

Based on $ARGUMENTS, run:
```bash
task-master list --status=$ARGUMENTS
```

## Enhanced Display

For the filtered results:
- Group by priority within the status
- Show time in current status
- Highlight tasks approaching deadlines
- Display blockers and dependencies
- Suggest next actions for each status group

## Intelligent Insights

Based on the status filter:
- **Pending**: Show recommended start order
- **In-Progress**: Display idle time warnings
- **Done**: Show newly unblocked tasks
- **Review**: Indicate review duration
- **Deferred**: Show reactivation criteria
- **Cancelled**: Display impact analysis