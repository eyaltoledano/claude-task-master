List tasks with flexible filtering and display options based on $ARGUMENTS.

Parse arguments to determine what to show:
- No arguments: Show all tasks
- Status keywords (pending, done, in-progress): Filter by status
- "subtasks": Include subtasks in listing
- "tree": Show hierarchical view
- "priority:high/medium/low": Filter by priority
- Numbers: Show specific task IDs

Execute the appropriate listing:

1. **Parse Arguments**
   - Determine filters from $ARGUMENTS
   - Set appropriate task-master list flags

2. **Run Task Listing**
   Examples based on arguments:
   - All tasks: `task-master list`
   - By status: `task-master list -s pending`
   - With subtasks: `task-master list --with-subtasks`
   - With complexity: `task-master list -r .taskmaster/reports/complexity-*.json`

3. **Format Output**
   Create a clear, organized display:

   **Standard View:**
   ```
   📋 Task List
   ============
   
   🔴 High Priority
   ----------------
   #1  ⏳ [Task Title] - Dependencies: none
   #5  ⏳ [Task Title] - Dependencies: #1, #2
   
   🟡 Medium Priority
   ------------------
   #2  ✅ [Task Title] - Dependencies: none
   #3  🔄 [Task Title] - Dependencies: #2
   
   🟢 Low Priority
   ---------------
   #4  ⏳ [Task Title] - Dependencies: #3
   
   Summary: 5 tasks (1 done, 1 in-progress, 3 pending)
   ```

   **Tree View (if requested):**
   ```
   📋 Task Hierarchy
   =================
   
   #1 [Task Title] ⏳
   ├── #1.1 [Subtask] ✅
   ├── #1.2 [Subtask] 🔄
   └── #1.3 [Subtask] ⏳
   
   #2 [Task Title] ✅
   └── (no subtasks)
   ```

4. **Status Legend**
   Include a legend for status symbols:
   - ⏳ Pending
   - 🔄 In Progress  
   - ✅ Done
   - 🚧 Blocked
   - ⏸️  Deferred
   - ❌ Cancelled

5. **Additional Information**
   Based on arguments, include:
   - Complexity scores (if available)
   - Time estimates
   - Dependency counts
   - Completion percentages

6. **Smart Filtering**
   Apply intelligent filters:
   - Hide completed subtasks by default
   - Show blocked tasks with blockers
   - Highlight overdue tasks
   - Group by milestone (if defined)

7. **Export Options**
   Offer to export in different formats:
   - Markdown table for documentation
   - CSV for spreadsheet analysis
   - JSON for programmatic use

8. **Quick Actions**
   Suggest relevant actions based on results:
   - If many pending: "Start next task"
   - If many complete: "Archive completed tasks"
   - If blocked tasks: "Review dependencies"