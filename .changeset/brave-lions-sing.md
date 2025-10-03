---
"task-master-ai": minor
---

Add Codex CLI provider with OAuth authentication

- Added codex-cli provider for GPT-5 and GPT-5-Codex models (272K input / 128K output)
- OAuth-first authentication via `codex login` - no API key required
- Optional OPENAI_API_KEY support for backward compatibility
- Codebase analysis capabilities automatically enabled
- Command-specific settings and approval/sandbox modes
