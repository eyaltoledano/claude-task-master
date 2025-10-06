---
"task-master-ai": patch
---

Fix MCP connection errors caused by deprecated generateTaskFiles calls. Resolves "Cannot read properties of null (reading 'toString')" errors when using MCP tools for task management operations.