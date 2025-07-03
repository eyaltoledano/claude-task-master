List tasks with intelligent argument parsing.

Parse arguments to determine filters and display options:
- Status: pending, in-progress, done, review, deferred, cancelled
- Priority: high, medium, low (or priority:high)
- Special: subtasks, tree, dependencies, blocked
- IDs: Direct numbers (e.g., "1,3,5" or "1-5")
- Complex: "pending high" = pending AND high priority

Arguments: $ARGUMENTS

Let me parse your request intelligently:

1. **Detect Filter Intent**
   - If arguments contain status keywords → filter by status
   - If arguments contain priority → filter by priority
   - If arguments contain "subtasks" → include subtasks
   - If arguments contain "tree" → hierarchical view
   - If arguments contain numbers → show specific tasks
   - If arguments contain "blocked" → show blocked tasks only

2. **Smart Combinations**
   Examples of what I understand:
   - "pending high" → pending tasks with high priority
   - "done today" → tasks completed today
   - "blocked" → tasks with unmet dependencies
   - "1-5" → tasks 1 through 5
   - "subtasks tree" → hierarchical view with subtasks

3. **Execute Appropriate Query**
   Based on parsed intent, run the most specific task-master command

4. **Enhanced Display**
   - Group by relevant criteria
   - Show most important information first
   - Use visual indicators for quick scanning
   - Include relevant metrics

5. **Intelligent Suggestions**
   Based on what you're viewing, suggest next actions:
   - Many pending? → Suggest priority order
   - Many blocked? → Show dependency resolution
   - Looking at specific tasks? → Show related tasks