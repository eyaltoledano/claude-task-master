---
"task-master-ai": minor
---

feat: add Claude Code SDK provider for API-key-free usage

- Add new ClaudeCodeProvider that integrates with @anthropic-ai/claude-code SDK
- Enable task-master-ai to work without API keys when Claude Code is installed
- Update ai-services-unified.js to include claude-code in PROVIDERS object
- Update config-manager to handle Claude Code's no-API-key requirement
- Fix EPIPE errors in displayUpgradeNotification and dev.js
- Add telemetry field compatibility (inputTokens/outputTokens)
- Add comprehensive test coverage for the new provider

This allows users with Claude Code installed to use task-master-ai seamlessly without needing to configure API keys.

Credits: Based on PR #777 by @neno-is-ooo and PR #649