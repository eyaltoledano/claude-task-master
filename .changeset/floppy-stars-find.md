---
"task-master-ai": minor
---

Add progress tracking for the parse-prd command across both MCP and CLI interfaces.

- Integrates the new `PrdParseTracker` utility to display multi-bar progress in the CLI, including dynamic ETA, token counts, and priority indicators.
- Emits MCP-compliant progress events that surface task titles, priorities, and token usage during streaming operations.
- Implements automatic fallback to non-streaming mode if streaming is unavailable, ensuring reliability in all environments.
- Establishes a reusable progress-tracking foundation to be leveraged by future long-running Task Master commands.
