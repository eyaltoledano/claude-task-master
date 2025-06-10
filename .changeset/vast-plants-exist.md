---
"task-master-ai": minor
---

- **Git Worktree Detection:**
  - Now properly skips Git initialization when inside existing Git worktree
  - Prevents accidental nested repository creation
- **Flag System Overhaul:**
  - `--git`/`--no-git` now reliably controls repository initialization
  - `--aliases`/`--no-aliases` consistently manages shell alias creation
  - `--dry-run` accurately previews all initialization behaviors

**Implementation Details:**
- Added explicit Git worktree detection before initialization
- Refactored flag processing to ensure consistent behavior

- Fixes #734