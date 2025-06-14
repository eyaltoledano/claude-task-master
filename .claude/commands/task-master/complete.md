Mark task #$ARGUMENTS as complete in Task Master.

Execute these steps carefully:

1. **Validate Task Completion**
   - Verify task #$ARGUMENTS exists and is currently 'in-progress'
   - Check if task has subtasks - all must be 'done' first
   - Ensure all tests related to the task are passing
   - Confirm implementation matches task requirements

2. **Run Final Checks**
   - Execute test suite: `npm test` (or appropriate test command)
   - Run linter: `npm run lint` (if available)
   - Check for TypeScript errors: `npm run typecheck` (if applicable)
   - Ensure no console.logs or debug code remains

3. **Update Documentation**
   - Update README.md if task added new features
   - Add inline documentation for new functions
   - Update API documentation if interfaces changed
   - Create or update examples if applicable

4. **Update Task Status**
   - Run `task-master set-status -i $ARGUMENTS -s done`
   - Add completion notes if significant decisions were made
   - Record actual time spent vs. estimate (if tracking)

5. **Handle Dependencies**
   - List tasks that depended on #$ARGUMENTS
   - Show which tasks are now unblocked
   - Recommend next task from newly available options

6. **Create Commit**
   - Stage all changes related to the task
   - Create commit with message:
     ```
     Complete task #$ARGUMENTS: [Task Title]
     
     - [Brief summary of what was implemented]
     - [Key decisions or changes made]
     - [Tests added/modified]
     
     Closes #$ARGUMENTS
     ```

7. **Update Task Files**
   - Regenerate task-*.md files to reflect new status
   - Ensure dependent task files show updated state

8. **Progress Report**
   Generate a brief report showing:
   - Task completed: #$ARGUMENTS
   - Time spent: [estimate]
   - Tasks unblocked: [list]
   - Overall progress: X% complete
   - Suggested next task: #[ID]

9. **Next Steps**
   Ask: "Task #$ARGUMENTS is now complete! Would you like to:
   1. Start the next recommended task (#[ID])
   2. Review the project status
   3. Take a break and commit your work"

If any validation fails, explain what needs to be fixed before marking complete.