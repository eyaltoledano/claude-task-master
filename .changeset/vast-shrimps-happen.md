---
"task-master-ai": patch
---

Add sync-readme command for a task export to GitHub README

Introduces a new `sync-readme` command that exports your task list to your project's README.md file.

**Features:**

- **Flexible filtering**: Supports `--status` filtering (e.g., pending, done) and `--with-subtasks` flag
- **Smart content management**: Automatically replaces existing exports or appends to new READMEs
- **Metadata display**: Shows export timestamp, subtask inclusion status, and filter settings

**Usage:**

- `task-master sync-readme` - Export tasks without subtasks
- `task-master sync-readme --with-subtasks` - Include subtasks in export
- `task-master sync-readme --status=pending` - Only export pending tasks
- `task-master sync-readme --status=done --with-subtasks` - Export completed tasks with subtasks

Perfect for showcasing project progress on GitHub. Experimental. Open to feedback.
