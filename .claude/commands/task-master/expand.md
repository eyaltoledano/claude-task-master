Expand task #$ARGUMENTS into subtasks using Task Master.

Follow this process:

1. **Validate Parent Task**
   - Verify task #$ARGUMENTS exists
   - Check that task is not already 'done'
   - Ensure task doesn't already have subtasks (warn if it does)
   - Confirm task is complex enough to warrant expansion

2. **Analyze Task for Breakdown**
   - Read the task's full details and requirements
   - Identify logical components or phases
   - Consider the test strategy for division points
   - Aim for 3-5 subtasks of 1-4 hours each

3. **Generate Subtasks**
   - Run `task-master expand -i $ARGUMENTS -n 5`
   - If task involves research, use: `task-master expand -i $ARGUMENTS -n 5 -r`
   - Review generated subtasks for completeness
   - Ensure subtasks cover all aspects of parent task

4. **Validate Subtask Quality**
   Each subtask should have:
   - Clear, actionable title
   - Specific description (1-4 hour scope)
   - Defined success criteria
   - Logical ordering

5. **Review and Adjust**
   - Display all generated subtasks
   - Check that they fully implement the parent task
   - Verify no functionality is missed
   - Ensure proper task sequencing

6. **Update Task Structure**
   - Save subtasks to tasks.json
   - Set parent task status (remains current status)
   - Generate new task-*.md files

7. **Show Expansion Results**
   Display the expansion in a tree format:
   ```
   Task #$ARGUMENTS: [Parent Title]
   ├── Subtask #$ARGUMENTS.1: [Title] (1-2 hrs)
   │   └─ [Brief description]
   ├── Subtask #$ARGUMENTS.2: [Title] (2-3 hrs)
   │   └─ [Brief description]
   ├── Subtask #$ARGUMENTS.3: [Title] (1-2 hrs)
   │   └─ [Brief description]
   └── Total estimated: X hours
   ```

8. **Update Documentation**
   - Regenerate task files
   - Update parent task to reference subtasks
   - Create subtask files with parent context

9. **Next Steps**
   Provide options:
   - "Start first subtask" → Show #$ARGUMENTS.1 details
   - "View updated project status"
   - "Expand another complex task"

10. **Commit Changes**
    Create commit: "Expand task #$ARGUMENTS into subtasks"

Note: Parent task is complete only when ALL subtasks are done.