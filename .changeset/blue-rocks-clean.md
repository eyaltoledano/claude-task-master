---
"task-master-ai": patch
---

Make `task-master update` more reliable with AI responses

The `update` command now handles AI responses more robustly. If the AI forgets to include certain task fields, the command will automatically fill in the missing data from your original tasks instead of failing. This means smoother bulk task updates without losing important information like IDs, dependencies, or completed subtasks.
