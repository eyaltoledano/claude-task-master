Clear all subtasks from all tasks globally.

## Global Subtask Clearing

Remove all subtasks across the entire project. Use with extreme caution.

## Execution

```bash
task-master clear-subtasks --all
```

## Pre-Clear Analysis

1. **Project-Wide Summary**
   ```
   Global Subtask Summary
   ━━━━━━━━━━━━━━━━━━━━
   Total parent tasks: 12
   Total subtasks: 47
   - Completed: 15
   - In-progress: 8
   - Pending: 24
   
   Work at risk: ~120 hours
   ```

2. **Critical Warnings**
   - In-progress subtasks that will lose work
   - Completed subtasks with valuable history
   - Complex dependency chains
   - Integration test results

## Double Confirmation

```
⚠️  DESTRUCTIVE OPERATION WARNING ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This will remove ALL 47 subtasks from your project
Including 8 in-progress and 15 completed subtasks

This action CANNOT be undone

Type 'CLEAR ALL SUBTASKS' to confirm:
```

## Smart Safeguards

- Require explicit confirmation phrase
- Create automatic backup
- Log all removed data
- Option to export first

## Use Cases

Valid reasons for global clear:
- Project restructuring
- Major pivot in approach
- Starting fresh breakdown
- Switching to different task organization

## Process

1. Full project analysis
2. Create backup file
3. Show detailed impact
4. Require confirmation
5. Execute removal
6. Generate summary report

## Alternative Suggestions

Before clearing all:
- Export subtasks to file
- Clear only pending subtasks
- Clear by task category
- Archive instead of delete

## Post-Clear Report

```
Global Subtask Clear Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Removed: 47 subtasks from 12 tasks
Backup saved: .taskmaster/backup/subtasks-20240115.json
Parent tasks updated: 12
Time estimates adjusted: Yes

Next steps:
- Review updated task list
- Re-expand complex tasks as needed
- Check project timeline
```