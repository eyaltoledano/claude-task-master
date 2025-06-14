Show comprehensive project status using Task Master.

Please provide the following information:

1. **Task Overview**
   - Run `task-master list` to get all tasks
   - Count tasks by status (pending, in-progress, done, etc.)
   - Calculate overall project completion percentage

2. **Current Sprint Status**
   - Show all in-progress tasks with assignee info (if available)
   - List blocked tasks and their blockers
   - Highlight overdue tasks (if any)

3. **Dependency Analysis**
   - Run `task-master validate-dependencies`
   - Show any circular dependencies or conflicts
   - List tasks that are ready to start (dependencies met)

4. **Next Tasks**
   - Run `task-master next` to get the recommended next task
   - Show top 5 tasks ready for implementation
   - Consider priority and complexity in recommendations

5. **Complexity Overview**
   - If complexity report exists, show distribution
   - Highlight high-complexity tasks that may need breakdown
   - Show estimated hours remaining

6. **Recent Progress**
   - List tasks completed in the last 7 days (check git history)
   - Show velocity trend if data is available

7. **Visual Summary**
   Create a text-based visualization showing:
   ```
   Project: [Name]
   ================
   Total Tasks: XX
   ✅ Done: XX (XX%)
   🔄 In Progress: XX
   ⏳ Pending: XX
   
   Ready to Start:
   - Task #X: [Title] (Priority: High)
   - Task #Y: [Title] (Priority: Medium)
   
   Blocked Tasks: X
   Critical Path: X tasks
   ```

8. **Recommendations**
   - Suggest focus areas based on dependencies
   - Recommend task breakdown for complex items
   - Propose sprint planning if many tasks are ready

Format the output clearly with sections and use emoji for visual clarity.