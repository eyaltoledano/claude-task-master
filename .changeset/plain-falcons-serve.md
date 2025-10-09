---
"task-master-ai": patch
---

Fix cross-level task dependencies not being saved

Fixes an issue where adding dependencies between subtasks and top-level tasks (e.g., `task-master add-dependency --id=2.2 --depends-on=11`) would report success but fail to persist the changes. Dependencies can now be created in both directions between any task levels.
