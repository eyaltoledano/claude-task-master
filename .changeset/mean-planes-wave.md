---
"task-master-ai": minor
---

Add Claude Code plugin with marketplace distribution

This release introduces official Claude Code plugin support, marking the evolution from legacy `.claude` directory copying to a modern plugin-based architecture.

## 🎉 New: Claude Code Plugin

Task Master AI commands and agents are now distributed as a proper Claude Code plugin:

- **49 slash commands** with clean naming (`/taskmaster:command-name`)
- **3 specialized AI agents** (task-orchestrator, task-executor, task-checker)
- **MCP server integration** for deep Claude Code integration

**Installation:**

```bash
/plugin marketplace add eyaltoledano/claude-task-master
/plugin install taskmaster@taskmaster
```

### The `rules add claude` command no longer copies commands and agents to `.claude/commands/` and `.claude/agents/`. Instead, it now

- Shows plugin installation instructions
- Only manages CLAUDE.md imports for agent instructions
- Directs users to install the official plugin

**Migration for Existing Users:**

If you previously used `rules add claude`:

1. The old commands in `.claude/commands/` will continue to work but won't receive updates
2. Install the plugin for the latest features: `/plugin install taskmaster@taskmaster`
3. remove old `.claude/commands/` and `.claude/agents/` directories

**Why This Change?**

Claude Code plugins provide:

- ✅ Automatic updates when we release new features
- ✅ Better command organization and naming
- ✅ Seamless integration with Claude Code
- ✅ No manual file copying or management

The plugin system is the future of Task Master AI integration with Claude Code!
