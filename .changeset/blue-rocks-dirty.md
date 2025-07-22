---
"task-master-ai": patch
---

Fix subtask dependency validation when expanding tasks

When using `task-master expand` to break down tasks into subtasks, dependencies between subtasks are now properly validated. Previously, subtasks with dependencies would fail validation. Now subtasks can correctly depend on their siblings within the same parent task.
