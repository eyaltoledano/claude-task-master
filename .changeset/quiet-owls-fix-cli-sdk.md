---
"task-master-ai": patch
---

fix(claude-code): prevent crash/hang when the optional `@anthropic-ai/claude-code` SDK is missing by guarding `AbortError instanceof` checks and adding explicit SDK presence checks in `doGenerate`/`doStream`. Also bump the optional dependency to `^1.0.88` for improved export consistency.

Related to JSON truncation handling in #920; this change addresses a separate error-path crash reported in #1142.

