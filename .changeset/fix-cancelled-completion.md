---
"task-master-ai": patch
---

Fix completion percentage and dependency resolution to treat cancelled tasks as complete. Cancelled tasks now correctly count toward project completion (e.g., 14 done + 1 cancelled = 100%, not 93%) and satisfy dependencies for dependent tasks, preventing permanent blocks.
