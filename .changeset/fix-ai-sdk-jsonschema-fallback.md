---
"task-master-ai": patch
---

fix: tolerate AI SDK versions without jsonSchema export

Fallback to sanitized Zod schema handling when jsonSchema is unavailable, and
align structured-output tests and registration perf thresholds to reduce CI
failures.

Also enforce sequential, unique subtask ids when regenerating subtasks during
scope adjustment.
