Show detailed information for task #$ARGUMENTS.

Display comprehensive task information:

1. **Basic Task Information**
   - Run `task-master show $ARGUMENTS` (if available) or parse from tasks.json
   - Parse outout and display:
     - Task ID and Title
     - Current Status and Priority
     - Creation date (if tracked)
     - Last modified date

2. **Task Details**
   - Full description
   - Implementation details
   - Test strategy
   - Acceptance criteria
   - Estimated hours (from complexity analysis if available)

3. **Dependencies**
   - **Depends On**: List tasks this depends on with their status
   - **Blocks**: List tasks that depend on this task
   - **Dependency Chain**: Show full upstream path to root tasks
   - Highlight any circular dependencies (error state)

4. **Subtasks** (if any)
   - List all subtasks with their status
   - Show completion percentage
   - Highlight incomplete subtasks

5. **Related Code Context**
   - Search for files mentioned in task description
   - Find test files that might need updates
   - Show recent commits related to dependent tasks
   - List similar implementations in codebase

6. **Implementation History** (if task is done/in-progress)
   - Show commits that reference this task ID
   - Display files changed for this task
   - Time spent (if tracked in commits)

7. **Task File Contents**
   - If task-$ARGUMENTS.md exists, display its contents
   - Show any additional notes or context

8. **Complexity Analysis** (if available)
   - Complexity score and factors
   - Suggested implementation approach
   - Risk areas identified

9. **Visual Task Card**
   Create a formatted task card:
   ```
   ┌─────────────────────────────────────┐
   │ Task #$ARGUMENTS: [Title]           │
   ├─────────────────────────────────────┤
   │ Status: [Status] | Priority: [P]    │
   │ Complexity: [Score] | Est: [X]hrs   │
   ├─────────────────────────────────────┤
   │ Description:                        │
   │ [Description text wrapped]          │
   ├─────────────────────────────────────┤
   │ Depends on: #X, #Y (✓), #Z (✓)    │
   │ Blocks: #A, #B, #C                 │
   └─────────────────────────────────────┘
   ```

10. **Action Options**
    Based on task status, suggest actions:
    - If pending: "Start this task" → `/project:task-master:start $ARGUMENTS`
    - If in-progress: "Complete this task" → `/project:task-master:complete $ARGUMENTS`
    - If complex: "Expand into subtasks" → `/project:task-master:expand $ARGUMENTS`
    - If blocked: Show what needs completion first