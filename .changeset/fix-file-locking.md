---
"task-master-ai": patch
---

Fix race condition when multiple Claude Code windows write to tasks.json simultaneously

- Add cross-process file locking to prevent concurrent write collisions
- Implement atomic writes using temp file + rename pattern to prevent partial writes
- Re-read file inside lock to get current state, preventing lost updates from stale snapshots
- Add stale lock detection and automatic cleanup (10-second timeout)
- Export `withFileLock` and `withFileLockSync` utilities for use by other modules

This fix prevents data loss that could occur when multiple Task Master instances (e.g., multiple Claude Code windows) access the same tasks.json file concurrently.
