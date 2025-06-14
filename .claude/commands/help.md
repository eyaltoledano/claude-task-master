Show comprehensive help for Task Master slash commands.

Display organized help information based on $ARGUMENTS:

If no arguments, show overview. Otherwise, show specific help for the requested topic.

## Task Master Slash Commands Help

### 📋 Core Task Management

**/project:task-master:init** `<prd-file>`
Initialize a new project from a PRD file
Example: `/project:task-master:init requirements.md`

**/project:task-master:parse-prd** `<prd-file>`
Parse PRD and generate tasks (alternative to init)
Example: `/project:task-master:parse-prd docs/prd.txt`

**/project:task-master:status**
Show comprehensive project status and progress
Example: `/project:task-master:status`

**/project:task-master:list** `[filters]`
List tasks with optional filters (pending, done, tree, priority:high)
Example: `/project:task-master:list pending priority:high`

**/project:task-master:next**
Find and prepare the next task to work on
Example: `/project:task-master:next`

**/project:task-master:show** `<task-id>`
Display detailed information about a specific task
Example: `/project:task-master:show 5`

**/project:task-master:add** `<description>`
Add a new task with AI assistance
Example: `/project:task-master:add Implement user login with OAuth`

**/project:task-master:start** `<task-id>`
Start working on a task (sets up everything needed)
Example: `/project:task-master:start 3`

**/project:task-master:complete** `<task-id>`
Mark a task as complete with validation
Example: `/project:task-master:complete 3`

**/project:task-master:update** `<task-id> <changes>`
Update task information
Example: `/project:task-master:update 5 set priority to high`

**/project:task-master:expand** `<task-id>`
Break a complex task into subtasks
Example: `/project:task-master:expand 8`

**/project:task-master:validate-deps**
Check all dependencies for issues and conflicts
Example: `/project:task-master:validate-deps`

### 🔄 Workflow Automation

**/project:workflows:auto-implement**
Automatically implement the next task with AI
Example: `/project:workflows:auto-implement`

**/project:workflows:sprint-plan** `[duration]`
Create an intelligent sprint plan
Example: `/project:workflows:sprint-plan 2-weeks`

**/project:workflows:daily-standup**
Generate standup report and plan the day
Example: `/project:workflows:daily-standup`

### 🛠️ Utility Commands

**/project:utils:check-health**
Run comprehensive project health diagnostics
Example: `/project:utils:check-health`

**/project:utils:sync-memory**
Update CLAUDE.md with current project state
Example: `/project:utils:sync-memory`

**/project:utils:complexity-report**
Generate or view task complexity analysis
Example: `/project:utils:complexity-report`

### 📚 Quick Reference

**Task Status Values:**
- `pending` - Not started
- `in-progress` - Currently working
- `done` - Completed
- `review` - Needs review
- `deferred` - Postponed
- `cancelled` - Cancelled

**Priority Levels:**
- `high` - Critical/blocking tasks
- `medium` - Important features
- `low` - Nice-to-have items

**Common Workflows:**

1. **Starting a new project:**
   ```
   /project:task-master:init requirements.md
   /project:task-master:status
   /project:task-master:next
   ```

2. **Daily development flow:**
   ```
   /project:workflows:daily-standup
   /project:task-master:next
   /project:workflows:auto-implement
   ```

3. **Task breakdown:**
   ```
   /project:task-master:show 10
   /project:task-master:expand 10
   /project:task-master:list subtasks
   ```

### 💡 Pro Tips

1. **Use Tab Completion**: Type `/project:` and see available commands
2. **Chain Commands**: Complete one task and start the next
3. **Regular Health Checks**: Run weekly to catch issues early
4. **Sync Memory**: Keep CLAUDE.md updated for better assistance
5. **Sprint Planning**: Use complexity reports for accurate planning

### 🔍 Getting More Help

- For command details: `/project:help <command-name>`
- View command source: `cat .claude/commands/<command>.md`
- Check documentation: See `docs/` directory
- Review examples: Look in command files

### 🎯 Next Steps

Based on your project state:
- No tasks? Start with `/project:task-master:init`
- Tasks exist? Check `/project:task-master:status`
- Ready to work? Use `/project:task-master:next`

Type any command to begin!