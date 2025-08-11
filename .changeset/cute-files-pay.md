---
"task-master-ai": minor
---

Add compact mode --compact / -c flag to the `tm list` CLI command

- outputs tasks in a minimal, git-style one-line format. This reduces verbose output from ~30+ lines of dashboards and tables to just 1 line per task, making it much easier to quickly scan available tasks.
  - Git-style format: ID STATUS TITLE (PRIORITY) → DEPS
  - Color-coded status, priority, and dependencies
  - Smart title truncation and dependency abbreviation
  - Subtask support with indentation
  - Full backward compatibility with existing list options
