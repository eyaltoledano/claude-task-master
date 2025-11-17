---
"task-master-ai": patch
---

Fix MCP server connection issues by patching fastmcp to include completions capability

- This resolves errors where MCP clients (like Cursor) failed to connect to the Task Master MCP server:
  - [#1413](https://github.com/eyaltoledano/claude-task-master/issues/1413)
  - [#1411](https://github.com/eyaltoledano/claude-task-master/issues/1411)
