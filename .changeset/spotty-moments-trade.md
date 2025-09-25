---
"task-master-ai": patch
---

Fix set-status for subtasks:

- Parent tasks are now set as `done` when subtasks are all `done`
- Parent tasks are now set as `in-progress` when at least one subtask is `in-progress` or `done`
