---
"task-master-ai": patch
---

Fix expand task generating unrelated generic subtasks

Fixed an issue where `task-master expand` would generate generic authentication-related subtasks regardless of the parent task context when using complexity reports. The expansion now properly includes the parent task details alongside any expansion guidance.
