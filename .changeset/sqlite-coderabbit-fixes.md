---
"task-master-ai": minor
---

Add SQLite storage backend improvements and CodeRabbit review fixes

- Optimized JSONL sync with tag-scoped updates (no longer full export on every change)
- Fixed subtask counting asymmetry in storage validation
- Added backup path containment validation for security
- Fixed getAllTags to include empty tags (tags with metadata but no tasks)
- Added parent task status cascade to pending when all subtasks are pending
- Fixed resource leaks with proper finally blocks in migration methods
- Normalized task dependencies to strings for consistent ID comparison
- Added comprehensive test coverage for all fixes
