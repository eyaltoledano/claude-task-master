---
"task-master-ai": minor
---

Add tool search tool for Claude Code MCP server and enable deferred MCP loading

- Added new tool search tool capabilities for the Taskmaster MCP in Claude Code
- Running `task-master rules add claude` now automatically configures your shell (`~/.zshrc`, `~/.bashrc`, or PowerShell profile) with `ENABLE_EXPERIMENTAL_MCP_CLI=true` to enable deferred MCP loading
- **Context savings**: Deferred loading saves ~16% of Claude Code's 200k context window (~33k tokens for Task Master alone). Savings apply to all MCP servers, so total savings may be higher depending on your setup.
