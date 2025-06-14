# Claude Code Integration Documentation

Documentation for integrating Task Master with Claude Code.

## Contents

### Integration Guide
See [CLAUDE_CODE_TASK_MASTER_INTEGRATION.md](documentation/CLAUDE_CODE_TASK_MASTER_INTEGRATION.md) for:
- Custom slash commands for Task Master
- MCP server configuration
- Implementation patterns

### Example Commands
Ready-to-use command templates in `example-commands/`:
- `fix-issue.md` - GitHub issue workflow
- `optimize.md` - Performance optimization
- `refactor.md` - Code refactoring
- `review.md` - Code review process
- `test-gen.md` - Test generation

## Key Integration Points

1. **Slash Commands**: Task Master operations available as `/project:tm/*` commands
2. **MCP Server**: Direct tool access via Model Context Protocol
3. **Natural Language**: All commands accept natural language arguments
4. **Context Awareness**: Commands adapt based on project state

See `.claude/TM_COMMANDS_GUIDE.md` for complete command reference.