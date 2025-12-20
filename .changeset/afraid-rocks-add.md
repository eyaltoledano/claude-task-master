---
"task-master-ai": patch
---

fix(codex-cli): Validate reasoning effort against model capabilities

- Add provider-level reasoning effort validation for OpenAI models
- Automatically cap unsupported effort levels (e.g., 'xhigh' on gpt-5.1 becomes 'high')
- Override Codex CLI global config to prevent 400 errors from unsupported reasoning levels
- Add documentation explaining why .strict() is required on Zod schemas for OpenAI Structured Outputs
