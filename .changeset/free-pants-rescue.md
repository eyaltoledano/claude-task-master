---
"task-master-ai": minor
---

Enhance update-task with --append flag for timestamped task updates

Adds the `--append` flag to `update-task` command, enabling it to behave like `update-subtask` with timestamped information appending. This provides more flexible task updating options:

**CLI Enhancement:**
- `task-master update-task --id=5 --prompt="New info"` - Full task update (existing behavior)
- `task-master update-task --id=5 --append --prompt="Progress update"` - Append timestamped info to task details

**Full MCP Integration:**
- MCP tool `update_task` now supports `append` parameter
- Seamless integration with Cursor and other MCP clients
- Consistent behavior between CLI and MCP interfaces

Instead of requiring separate subtask creation for progress tracking, you can now append timestamped information directly to parent tasks while preserving the option for comprehensive task updates.

