---
"@tm/cli": minor
"task-master-ai": minor
---

Add interactive Terminal UI for real-time task monitoring and navigation

Introduces a new `task-master interactive` command (alias: `tui`) that launches a full-featured, keyboard-driven terminal dashboard with:

- Real-time task monitoring with automatic updates when project files change (~500ms)
- Dashboard with three sections: Project overview, Dependency status, and Task list
- Keyboard navigation: arrow keys, PgUp/PgDn, Enter for task details
- Section maximize/restore with keys 0-3
- Task details modal showing parent task, dependencies, complexity, and test strategy
- Help panel with keyboard shortcuts (Tab to toggle)
- Onboarding guidance for uninitialized projects

Usage: `task-master interactive` or `task-master tui`
Options: `--panel=dashboard|help` and `--project=/path/to/project`
