# Gemini CLI-Specific Instructions

> **Note:** This file works alongside `AGENTS.md` (generic AI agent instructions). AGENTS.md contains the core Task Master commands and workflows for all AI agents. This file contains only Gemini CLI-specific features and integrations.

## MCP Configuration for Gemini CLI

Configure Task Master MCP server in `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "task-master-ai"]
    }
  }
}
```

**Note:** API keys are configured via `task-master models --setup`, not in MCP configuration.

## Gemini CLI-Specific Features

### Session Management

Built-in session commands:

- `/chat` - Start new conversation while keeping context
- `/checkpoint save <name>` - Save session state
- `/checkpoint load <name>` - Resume saved session
- `/memory show` - View loaded context

Both `AGENTS.md` and `GEMINI.md` are auto-loaded on every Gemini CLI session.

### Headless Mode for Automation

Non-interactive mode for scripts:

```bash
# Simple text response
gemini -p "What's the next task?"

# JSON output for parsing
gemini -p "List all pending tasks" --output-format json

# Stream events for long operations
gemini -p "Expand all tasks" --output-format stream-json
```

### Token Usage Monitoring

```bash
# In Gemini CLI session
/stats

# Shows: token usage, API costs, request counts
```

### Google Search Grounding

Leverage built-in Google Search as an alternative to Perplexity research mode:
- Best practices research
- Library documentation
- Security vulnerability checks
- Implementation patterns

## Important Differences from Other Agents

### No Slash Commands
Gemini CLI does not support custom slash commands (unlike Claude Code). Use natural language instead.

### No Tool Allowlist
Security is managed at the MCP level, not via agent configuration.

### Session Persistence
Use `/checkpoint` instead of git worktrees for managing multiple work contexts.

### Configuration Files
- Global: `~/.gemini/settings.json`
- Project: `.gemini/settings.json`
- **Not**: `.mcp.json` (that's for Claude Code)

## Recommended Model Configuration

For Gemini CLI users:

```bash
# Set Gemini as primary model
task-master models --set-main gemini-2.0-flash-exp
task-master models --set-fallback gemini-1.5-flash

# Optional: Use Perplexity for research (or rely on Google Search)
task-master models --set-research perplexity-llama-3.1-sonar-large-128k-online
```

## Your Role with Gemini CLI

As a Gemini CLI assistant with Task Master:

1. **Use MCP tools naturally** - They integrate transparently in conversation
2. **Reference files with @** - Leverage Gemini's file inclusion
3. **Save checkpoints** - Offer to save state after significant progress
4. **Monitor usage** - Remind users about `/stats` for long sessions
5. **Use Google Search** - Leverage search grounding for research

**Key Principle:** Focus on natural conversation. Task Master MCP tools work seamlessly with Gemini CLI's interface.

---

*See AGENTS.md for complete Task Master commands, workflows, and best practices.*
