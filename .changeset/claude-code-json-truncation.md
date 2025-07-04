---
"task-master-ai": patch
---

Recover from `@anthropic-ai/claude-code` JSON truncation bug that caused Task Master to crash when handling large (>8 kB) structured responses.  The CLI/SDK still truncates, but Task Master now detects the error, preserves buffered text, and returns a usable response instead of throwing. 