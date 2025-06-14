# Task Master for Claude Code

This directory enables Task Master functionality within Claude Code through slash commands.

## Features

- **All Task Master commands** available via `/project:tm/`
- **Natural language support** - type what you want to do
- **Hierarchical structure** matching Task Master's CLI
- **Smart automation** with context awareness

See [TM_COMMANDS_GUIDE.md](TM_COMMANDS_GUIDE.md) for complete documentation.

## Quick Start

```bash
# Install Task Master
/project:tm/setup/quick-install

# Initialize and start
/project:tm/init/quick
/project:tm/parse-prd requirements.md
/project:tm/next
```

## Structure

- `CLAUDE.md` - Project memory for Claude
- `TM_COMMANDS_GUIDE.md` - Complete command reference
- `mcp.json` - MCP server configuration
- `commands/tm/` - All command implementations (50+ files)