# Claude Task Master Project Guide

## Project Overview

Claude Task Master is an AI-driven task management system for software engineering projects. It provides both CLI and MCP interfaces for intelligent task generation, dependency management, and project organization.

## Key Concepts

### Task Structure
- **Tasks**: Atomic units of work (2-8 hours) with id, title, description, details, testStrategy, status, dependencies, and priority
- **Subtasks**: Nested tasks (1-4 hours) that break down parent tasks
- **Dependencies**: Tasks can depend on other tasks, creating a directed acyclic graph
- **Status Flow**: pending → in-progress → done (also: review, deferred, cancelled)

### File Locations
- `tasks.json`: Main task data storage in project root
- `.taskmaster/config.json`: Configuration file
- `task-*.md`: Individual task files for AI agents
- `.taskmaster/reports/`: Complexity analysis reports

### Command Patterns
All Task Master CLI commands follow the pattern:
```bash
task-master <command> [options]
```

For programmatic use via Node.js:
```bash
node scripts/dev.js <command> [options]
```

## Integration with Claude Code

### Available Slash Commands
Task Master slash commands are organized in `.claude/commands/`:
- `task-master/`: Core task management commands
- `workflows/`: Multi-step automated workflows
- `utils/`: Helper and utility commands

### Using Task Master Commands

1. **Always check for tasks.json existence** before running commands
2. **Use relative paths** when specifying files
3. **Commit task updates** after making changes
4. **Run tests** after implementing tasks
5. **Update task status** as work progresses

### Best Practices

1. **Task Generation**
   - Generate 10-15 tasks for typical features
   - Include tasks for tests, documentation, and deployment
   - Set logical dependencies between tasks

2. **Task Implementation**
   - Work on one task at a time
   - Follow the task's test strategy
   - Update status to 'in-progress' when starting
   - Mark as 'done' only when fully complete

3. **State Management**
   - Task Master is the source of truth for task state
   - Sync before starting work each day
   - Commit task updates regularly

### Common Workflows

1. **Starting a New Project**
   ```
   /project:task-master:init <prd-file>
   /project:task-master:status
   /project:task-master:next
   ```

2. **Daily Development**
   ```
   /project:task-master:status
   /project:task-master:next
   # ... implement task ...
   /project:task-master:complete <task-id>
   ```

3. **Task Expansion**
   ```
   /project:task-master:show <task-id>
   /project:task-master:expand <task-id>
   ```

## Architecture Notes

### AI Provider System
- **Main Provider**: General task operations (default: Claude)
- **Research Provider**: Enhanced research mode (default: Perplexity)
- **Fallback Provider**: Backup when main fails

### Task ID Management
- Tasks use sequential integer IDs
- Subtasks use dotted notation: "parentId.subtaskId"
- IDs are immutable once assigned

### Dependency Management
- Circular dependencies are detected and prevented
- Tasks with unmet dependencies cannot be started
- Use `validate-dependencies` to check for issues

## Troubleshooting

### Common Issues

1. **No tasks.json found**
   - Run `/project:task-master:init` or `task-master parse-prd`
   - Check if you're in the correct directory

2. **Task not found**
   - Verify task ID with `/project:task-master:list`
   - Check if using correct ID format

3. **Dependency conflicts**
   - Run `/project:task-master:validate-deps`
   - Use `/project:task-master:fix-deps` if available

### Debug Mode
Set `DEBUG=1` environment variable for verbose output:
```bash
DEBUG=1 task-master list
```

## Project-Specific Notes

_Add project-specific information here as you work with the codebase._

### Recent Decisions
- 

### Known Issues
- 

### Team Conventions
- 