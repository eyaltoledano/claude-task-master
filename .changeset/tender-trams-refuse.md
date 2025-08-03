---
"task-master-ai": patch
---

Fix MCP scope-up/down tools not finding tasks

- Fixed task ID parsing in MCP layer - now correctly converts string IDs to numbers
- scope_up_task and scope_down_task MCP tools now work properly
