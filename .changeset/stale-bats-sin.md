---
'task-master-ai': minor
---

Enhanced get-task/show command to support comma-separated task IDs for efficient batch operations

**New Features:**
- **Multiple Task Retrieval**: Pass comma-separated IDs to get/show multiple tasks at once (e.g., `task-master show 1,3,5` or MCP `get_task` with `id: "1,3,5"`)
- **Smart Display Logic**: Single ID shows detailed view, multiple IDs show compact summary table with interactive options
- **Batch Action Menu**: Interactive menu for multiple tasks with copy-paste ready commands for common operations (mark as done/in-progress, expand all, view dependencies, etc.)
- **MCP Array Response**: MCP tool returns structured array of task objects for efficient AI agent context gathering

**Benefits:**
- **Faster Context Gathering**: AI agents can collect multiple tasks/subtasks in one call instead of iterating
- **Improved Workflow**: Interactive batch operations reduce repetitive command execution
- **Better UX**: Responsive layout adapts to terminal width, maintains consistency with existing UI patterns
- **API Efficiency**: RESTful array responses in MCP format enable more sophisticated integrations

This enhancement maintains full backward compatibility while significantly improving efficiency for both human users and AI agents working with multiple tasks.

