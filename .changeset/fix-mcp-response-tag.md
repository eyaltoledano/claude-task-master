---
"task-master-ai": patch
---

Fix MCP tool responses returning the wrong active tag when a `tag` argument is passed explicitly. Tools like `next_task`, `add_task`, `update_task`, `update_subtask`, `expand_task`, `remove_task`, `move_task` and others now report the requested tag in their response payload instead of falling back to `currentTag` from `.taskmaster/state.json`. Resolves #1683 (and related symptom in #1638).
