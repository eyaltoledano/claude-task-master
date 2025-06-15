---
'task-master-ai': patch
---

Fix critical bugs in task move functionality:

- **Fixed moving tasks to become subtasks of empty parents**: When moving a task to become a subtask of a parent that had no existing subtasks (e.g., task 89 → task 98.1), the operation would fail with validation errors.

- **Fixed moving subtasks between parents**: Subtasks can now be properly moved between different parent tasks, including to parents that previously had no subtasks.

- **Improved comma-separated batch moves**: Multiple tasks can now be moved simultaneously using comma-separated IDs (e.g., "88,90" → "92,93") with proper error handling and atomic operations.

These fixes enables proper task hierarchy reorganization for corner cases that were previously broken.

