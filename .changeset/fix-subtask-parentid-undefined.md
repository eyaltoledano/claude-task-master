---
"task-master-ai": patch
---

Stop writing `"parentId": "undefined"` into legacy subtasks (those that only have `parentTaskId`) when `tasks.json` is saved, e.g. by `set-status`. The parent ID now falls back to the enclosing task ID.
