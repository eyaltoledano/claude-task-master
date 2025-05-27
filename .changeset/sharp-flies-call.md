---
'task-master-ai': minor
---

Add TASK_MASTER_PROJECT_ROOT env variable supported in mcp.json and .env for project root resolution

- Some users were having issues where the MCP wasn't able to detect the location of their project root, you can now set the `TASK_MASTER_PROJECT_ROOT` environment variable to the root of your project.
