Add a new task with description: $ARGUMENTS

Create a new task intelligently based on the provided description:

1. **Parse Task Description**
   - Extract key information from $ARGUMENTS
   - Identify if this is a feature, bug fix, refactor, test, or documentation
   - Determine likely priority based on keywords (critical, urgent, minor)

2. **Check for Related Tasks**
   - Search existing tasks for similar titles or descriptions
   - Identify potential dependencies based on task content
   - Warn if a very similar task already exists

3. **Generate Task with AI**
   - Run `task-master add-task -p "$ARGUMENTS"`
   - Let AI expand the brief description into:
     - Detailed implementation requirements
     - Clear test strategy
     - Appropriate time estimate (2-8 hours)

4. **Set Task Properties**
   - Assign next available ID
   - Set initial status to 'pending'
   - Determine priority (high/medium/low)
   - Identify dependencies from context

5. **Enhance Task Details**
   Based on task type, add specific details:
   
   **For Features:**
   - User story format
   - Acceptance criteria
   - UI/UX considerations
   
   **For Bug Fixes:**
   - Steps to reproduce
   - Expected vs actual behavior
   - Affected components
   
   **For Refactoring:**
   - Current problems
   - Proposed improvements
   - Risk assessment

6. **Validate Task Scope**
   - Ensure task is atomic (2-8 hours)
   - If too large, suggest breaking into subtasks
   - If too small, suggest combining with related work

7. **Set Dependencies**
   - Auto-detect dependencies from description
   - Verify dependencies exist
   - Check for circular dependencies

8. **Generate Task File**
   - Create task-[ID].md with full details
   - Include context from related tasks
   - Add implementation hints

9. **Display New Task**
   Show the created task:
   ```
   ✅ Task Created Successfully!
   
   Task #[ID]: [Title]
   Priority: [Priority]
   Status: Pending
   Dependencies: [List or "none"]
   
   Description:
   [Full description]
   
   Next steps:
   - Start this task: /project:task-master:start [ID]
   - Add subtasks: /project:task-master:expand [ID]
   - View all tasks: /project:task-master:list
   ```

10. **Update Project State**
    - Save to tasks.json
    - Commit with message: "Add task #[ID]: [Title]"
    - Update task count in CLAUDE.md

Handle edge cases:
- If no description provided, prompt for more details
- If task seems like multiple tasks, suggest splitting
- If task duplicates existing work, show the duplicate