# Claude Code Integration for Task Master

This directory contains Claude Code slash commands and configuration for seamless integration with the Task Master project management system.

## Directory Structure

```
.claude/
├── README.md           # This file
├── CLAUDE.md          # Claude's memory about the project
├── mcp.json           # MCP server configuration
└── commands/          # Slash commands
    ├── help.md        # General help command
    ├── task-master/   # Core task management commands
    │   ├── init.md
    │   ├── parse-prd.md
    │   ├── status.md
    │   ├── list.md
    │   ├── next.md
    │   ├── show.md
    │   ├── add.md
    │   ├── start.md
    │   ├── complete.md
    │   ├── update.md
    │   ├── expand.md
    │   └── validate-deps.md
    ├── workflows/     # Automated workflows
    │   ├── auto-implement.md
    │   ├── sprint-plan.md
    │   └── daily-standup.md
    └── utils/         # Utility commands
        ├── check-health.md
        ├── sync-memory.md
        └── complexity-report.md
```

## Quick Start

1. **First Time Setup**
   ```
   /project:help
   /project:utils:check-health
   ```

2. **Initialize a Project**
   ```
   /project:task-master:init requirements.md
   ```

3. **Daily Workflow**
   ```
   /project:workflows:daily-standup
   /project:task-master:next
   ```

## Command Categories

### Task Management (`task-master/`)
Core commands for managing tasks, dependencies, and project state.

### Workflows (`workflows/`)
Multi-step automated processes that combine multiple operations.

### Utilities (`utils/`)
Helper commands for maintenance, analysis, and project health.

## MCP Integration

The `mcp.json` file configures the Model Context Protocol server, enabling:
- Direct access to Task Master tools
- Persistent task state management
- Cross-tool coordination

## CLAUDE.md

This file serves as Claude's memory about your project, containing:
- Project overview and current state
- Common workflows and patterns
- Team conventions and decisions
- Known issues and solutions

Keep it updated with `/project:utils:sync-memory`.

## Customization

### Adding New Commands

1. Create a new `.md` file in the appropriate subdirectory
2. Use `$ARGUMENTS` for dynamic parameters
3. Follow the existing command patterns
4. Test the command thoroughly

### Example Custom Command

```markdown
# .claude/commands/custom/my-command.md
Process $ARGUMENTS with custom logic.

1. Parse the arguments
2. Execute necessary operations
3. Provide clear output
```

## Best Practices

1. **Regular Health Checks**: Run `/project:utils:check-health` weekly
2. **Memory Sync**: Update CLAUDE.md after major milestones
3. **Commit Commands**: Version control your custom commands
4. **Document Workflows**: Add successful patterns to CLAUDE.md

## Troubleshooting

- **Command not found**: Check spelling and path
- **MCP not connecting**: Verify server path in mcp.json
- **Stale information**: Run memory sync command
- **Performance issues**: Check health and complexity reports

## Integration with Task Master

These commands are designed to work seamlessly with Task Master's:
- CLI commands (`task-master <command>`)
- MCP tools (via the configured server)
- File structure (tasks.json, .taskmaster/)

## Contributing

When adding new commands:
1. Follow the established patterns
2. Include comprehensive error handling
3. Provide clear user feedback
4. Update this README

For more information, see the main Task Master documentation.