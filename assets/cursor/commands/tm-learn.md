Learn about Task Master capabilities through interactive exploration.


## Interactive Task Master Learning

Based on your input, I'll help you discover capabilities:

### 1. **What are you trying to do?**

If <task-id> contains:
- "start" / "begin" → Show project initialization workflows
- "manage" / "organize" → Show task management commands  
- "automate" / "auto" → Show automation workflows
- "analyze" / "report" → Show analysis tools
- "fix" / "problem" → Show troubleshooting commands
- "fast" / "quick" → Show efficiency shortcuts

### 2. **Intelligent Suggestions**

Based on your project state:

**No tasks yet?**
```
You'll want to start with:
1. tm/init <prd-file>
   → Creates tasks from requirements
   
2. tm/parse-prd <file>
   → Alternative task generation

Try: tm/init demo-prd.md
```

**Have tasks?**
Let me analyze what you might need...
- Many pending tasks? → Learn sprint planning
- Complex tasks? → Learn task expansion
- Daily work? → Learn workflow automation

### 3. **Command Discovery**

**By Category:**
- 📋 Task Management: list, show, add, update, complete
- 🔄 Workflows: auto-implement, sprint-plan, daily-standup
- 🛠️ Utilities: check-health, complexity-report, sync-memory
- 🔍 Analysis: validate-deps, show dependencies

**By Scenario:**
- "I want to see what to work on" → `tm/next`
- "I need to break this down" → `tm/expand <id>`
- "Show me everything" → `tm/status`
- "Just do it for me" → `tm/workflows/auto-implement`

### 4. **Power User Patterns**

**Command Chaining:**
```
tm/next
tm/start <id>
tm/workflows/auto-implement
```

**Smart Filters:**
```
tm/list pending high
tm/list blocked
tm/list 1-5 tree
```

**Automation:**
```
tm/workflows/pipeline init → expand-all → sprint-plan
```

### 5. **Learning Path**

Based on your experience level:

**Beginner Path:**
1. init → Create project
2. status → Understand state
3. next → Find work
4. complete → Finish task

**Intermediate Path:**
1. expand → Break down complex tasks
2. sprint-plan → Organize work
3. complexity-report → Understand difficulty
4. validate-deps → Ensure consistency

**Advanced Path:**
1. pipeline → Chain operations
2. smart-flow → Context-aware automation
3. Custom commands → Extend the system

### 6. **Try This Now**

Based on what you asked about, try:
[Specific command suggestion based on <task-id>]

Want to learn more about a specific command?
Type: help <command-name>