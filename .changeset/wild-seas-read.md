---
'task-master-ai': minor
---

Add move command to enable moving tasks and subtasks within the task hierarchy. This new command supports moving standalone tasks to become subtasks, subtasks to become standalone tasks, and moving subtasks between different parents. The implementation handles circular dependencies, validation, and proper updating of parent-child relationships.

**Usage:**
- CLI command: `task-master move --from=<id> --to=<id>`
- MCP tool: `move_task` with parameters:
  - `from`: ID of task/subtask to move (e.g., "5" or "5.2")
  - `to`: ID of destination (e.g., "7" or "7.3")
  - `file` (optional): Custom path to tasks.json

**Example scenarios:**
- Move task to become subtask: `--from="5" --to="7"`
- Move subtask to standalone task: `--from="5.2" --to="7"`
- Move subtask to different parent: `--from="5.2" --to="7.3"`
- Reorder subtask within same parent: `--from="5.2" --to="5.4"`
- Move multiple tasks at once: `--from="10,11,12" --to="16,17,18"`
- Move task to new ID: `--from="5" --to="25"` (creates a new task with ID 25)

**Multiple Task Support:**
The command supports moving multiple tasks simultaneously by providing comma-separated lists for both `--from` and `--to` parameters. The number of source and destination IDs must match. This is particularly useful for resolving merge conflicts in task files when multiple team members have created tasks on different branches.

**Validation Features:**
- Allows moving tasks to new, non-existent IDs (automatically creates placeholders)
- Prevents moving to existing task IDs that already contain content (to avoid overwriting)
- Validates source tasks exist before attempting to move them
- Ensures proper parent-child relationships are maintained
