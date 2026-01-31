---
"task-master-ai": patch
---

Fix inconsistent task ID serialization in tasks.json (#1583)

Task IDs were inconsistently saved as strings or numbers depending on which command was used (e.g., `set-status` vs `update-task`), causing unnecessary git diffs. The tm-core file storage adapter was incorrectly converting IDs to strings when file storage should use numbers. Task and subtask IDs are now consistently saved as numbers in tasks.json.
