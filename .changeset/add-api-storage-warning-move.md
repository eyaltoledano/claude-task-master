---
"task-master-ai": patch
---

Added warning to prevent move operations when using API storage (Hamster)

The `move` command now checks if you're using API storage (logged into Hamster) and shows a clear warning message instead of failing silently. Move operations require local file storage because they directly manipulate the tasks.json file structure.

**What changed:**
- Move operations via MCP now check for API storage before attempting the operation
- Clear error message explaining why move is not supported with API storage
- Guidance to log out or switch to file storage: `tm auth logout`

**Why this matters:**
When logged into Hamster, Task Master uses cloud API storage instead of local files. The move command was designed for file-based storage and won't work correctly with API storage. This change prevents confusing errors and guides users to the right solution.
