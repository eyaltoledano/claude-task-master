---
"task-master-ai": minor
---

Add configurable codebase analysis feature flag with multiple configuration sources

Users can now control whether codebase analysis features (Claude Code and Gemini CLI integration) are enabled through environment variables, MCP configuration, or project config files.

Priority order: .env > MCP session env > .taskmaster/config.json.

Set `TASKMASTER_ENABLE_CODEBASE_ANALYSIS=false` in `.env` to disable codebase analysis prompts and tool integration.
