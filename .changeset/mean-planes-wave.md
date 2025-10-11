---
"task-master-ai": minor
---

Add Claude Code plugin with marketplace distribution

This release introduces official Claude Code plugin support, enabling users to install Task Master AI directly through Claude Code's plugin system.

**New Features:**

- **Claude Code Plugin**: Complete plugin package with 49 slash commands and 3 specialized AI agents
- **Marketplace Integration**: Official marketplace at `.claude-plugin/marketplace.json` for easy distribution

**Installation:**

Users can now install via Claude Code:

```bash
/plugin marketplace add eyaltoledano/claude-task-master
/plugin install task-master-ai@task-master
```

**Plugin Contents:**

- 49 slash commands for task management (`/tm:*`)
- 3 AI agents (task-orchestrator, task-executor, task-checker)
- MCP server integration for deep Claude Code integration
