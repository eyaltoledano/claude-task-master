---
"task-master-ai": patch
---

Upgrade fastmcp dependency to solve `Server does not support completions (required for completion/complete)`

- This resolves errors where MCP clients (like Cursor) failed to connect to the Task Master MCP server:
  - [#1413](https://github.com/eyaltoledano/claude-task-master/issues/1413)
  - [#1411](https://github.com/eyaltoledano/claude-task-master/issues/1411)