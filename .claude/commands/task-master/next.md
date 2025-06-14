Find and prepare to work on the next task using Task Master.

Follow these steps:

1. **Identify Next Task**
   - Run `task-master next` to get the recommended task
   - If complexity report exists, factor in complexity scores
   - Consider current context and momentum

2. **Display Task Details**
   - Show the complete task information:
     - ID, Title, and Priority
     - Full description and implementation details
     - Test strategy and acceptance criteria
     - Dependencies (both upstream and downstream)

3. **Analyze Task Context**
   - Check git history for related changes
   - Search codebase for files mentioned in task
   - Review completed dependent tasks for context
   - Identify similar implementations in the codebase

4. **Prepare Development Environment**
   - List files likely to be modified
   - Show relevant documentation or README sections
   - Display current test commands from package.json
   - Check for existing tests related to this task

5. **Set Task Status**
   - Update task status to 'in-progress'
   - Add timestamp and developer info to task
   - Commit the status change with message: "Start task #[ID]: [Title]"

6. **Create Implementation Plan**
   - Break down the task into concrete steps
   - Identify potential challenges or unknowns
   - Suggest implementation approach
   - Estimate time to completion

7. **Set Up Task Branch** (if using git flow)
   - Create branch: `task-[ID]-[kebab-case-title]`
   - Switch to the new branch

8. **Final Checklist**
   Provide a ready-to-start checklist:
   - [ ] Task status updated to in-progress
   - [ ] Implementation plan created
   - [ ] Development environment prepared
   - [ ] Tests identified or planned
   - [ ] Git branch created (if applicable)

Ask: "Ready to start implementing task #[ID]? Would you like me to begin with [first step from plan]?"