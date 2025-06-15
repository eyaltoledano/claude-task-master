---
"task-master-ai": minor
---

Add Claude CLI provider for local AI assistance

- Add new `claude-cli` provider that uses Claude Code application via CLI
- Enable zero-cost AI assistance when Claude Code is installed locally
- Support all Task Master features (parse-prd, expand, generate) with Claude CLI
- Configure via `CLAUDE_CLI_COMMAND` environment variable
- Add support for custom Claude flags and configurations
- Include comprehensive documentation in CLAUDE_CLI_USAGE.md