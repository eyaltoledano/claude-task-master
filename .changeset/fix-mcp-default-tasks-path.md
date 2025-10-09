---
"task-master-ai": patch
---

Fix MCP server error when file parameter not provided - now properly constructs default tasks.json path instead of failing with 'tasksJsonPath is required' error.