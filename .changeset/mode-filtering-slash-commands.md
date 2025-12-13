---
"task-master-ai": minor
---

Add operating mode filtering for slash commands and rules

Solo mode and team mode now have distinct sets of commands and rules:
- **Solo mode**: Local file-based storage commands (parse-prd, add-task, expand, etc.) plus common commands
- **Team mode**: Team-specific commands (goham) plus common commands (show-task, list-tasks, help, etc.)

Both modes share common commands for viewing and navigating tasks. The difference is:
- Solo users get commands for local file management (PRD parsing, task expansion, dependencies)
- Team users get Hamster cloud integration commands instead

When switching modes (e.g., from solo to team), all existing TaskMaster commands and rules are automatically cleaned up before adding the new mode's files. This prevents orphaned commands/rules from previous modes.

The operating mode is auto-detected from config or auth status, and can be overridden with `--mode=solo|team` flag on the `rules` command.
