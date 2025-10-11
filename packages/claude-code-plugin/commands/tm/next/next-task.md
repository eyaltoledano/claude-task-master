Intelligently determine and prepare the next action based on comprehensive context.

This enhanced version of 'next' considers:
- Current task states
- Recent activity
- Time constraints
- Dependencies
- Your working patterns

Arguments: $ARGUMENTS

## Intelligent Next Action

### 1. **Context Gathering**
Let me analyze the current situation:
- Active tasks (in-progress)
- Recently completed tasks
- Blocked tasks
- Time since last activity
- Arguments provided: $ARGUMENTS

### 2. **Smart Decision Tree**

**If you have an in-progress task:**
- Has it been idle > 2 hours? → Suggest resuming or switching
- Near completion? → Show remaining steps
- Blocked? → Find alternative task

**If no in-progress tasks:**
- Unblocked high-priority tasks? → Start highest
- Complex tasks need breakdown? → Suggest expansion
- All tasks blocked? → Show dependency resolution

**Special arguments handling:**
- "quick" → Find task < 2 hours
- "easy" → Find low complexity task
- "important" → Find high priority regardless of complexity
- "continue" → Resume last worked task

### 3. **Preparation Workflow**

Based on selected task:
1. Show full context and history
2. Set up development environment
3. Run relevant tests
4. Open related files
5. Show similar completed tasks
6. Estimate completion time

### 4. **Alternative Suggestions**

Always provide options:
- Primary recommendation
- Quick alternative (< 1 hour)
- Strategic option (unblocks most tasks)
- Learning option (new technology/skill)

### 5. **Workflow Integration**

Seamlessly connect to:
- `/project:task-master:start [selected]` 
- `/project:workflows:auto-implement`
- `/project:task-master:expand` (if complex)
- `/project:utils:complexity-report` (if unsure)

The goal: Zero friction from decision to implementation.