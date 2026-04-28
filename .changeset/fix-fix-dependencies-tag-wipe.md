---
"task-master-ai": patch
---

Fix fix_dependencies MCP tool wiping all tags except 'master' from tasks.json. The tool now correctly scopes dependency fixes to the specified tag, preserving all other tags in multi-tag workspaces.
