---
"task-master-ai": minor
---

Add OpenCode as an AI provider. Delegates authentication, model routing, and provider selection to a running OpenCode server via `ai-sdk-provider-opencode-sdk`, so Task Master stays agnostic about the underlying LLM. This unblocks enterprise users whose organisations permit OpenCode (including its GitHub Copilot backend) but prohibit direct LLM API credentials.
