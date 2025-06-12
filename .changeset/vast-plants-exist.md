---
"task-master-ai": minor
---

- **Git Worktree Detection:**
  - Now properly skips Git initialization when inside existing Git worktree
  - Prevents accidental nested repository creation
- **Flag System Overhaul:**
  - `--git`/`--no-git` controls repository initialization
  - `--aliases`/`--no-aliases` consistently manages shell alias creation
  - `--git-tasks`/`--no-git-tasks` controls whether task files are stored in Git
  - `--dry-run` accurately previews all initialization behaviors
- **GitTasks Functionality:**
  - New `--git-tasks` flag includes task files in Git (comments them out in .gitignore)
  - New `--no-git-tasks` flag excludes task files from Git (default behavior)
  - Supports both CLI and MCP interfaces with proper parameter passing

**Implementation Details:**
- Added explicit Git worktree detection before initialization
- Refactored flag processing to ensure consistent behavior

- Fixes #734