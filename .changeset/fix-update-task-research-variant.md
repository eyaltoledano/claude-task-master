---
"task-master-ai": patch
---

Fix `update-task` and `update-subtask` crashing with `Cannot read properties of undefined (reading 'replace')` when the `--research` flag is used. Both commands were requesting a non-existent `research` prompt variant; they now correctly use the `default` variant, which already handles research mode via template conditionals.
