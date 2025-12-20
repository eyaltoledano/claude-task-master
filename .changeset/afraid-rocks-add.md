---
"task-master-ai": patch
---

Codex cli Validate reasoning effort against model capabilities

- Add provider-level reasoning effort validation for OpenAI models
- Automatically cap unsupported effort levels (e.g., 'xhigh' on gpt-5.1 and gpt-5 becomes 'high')
