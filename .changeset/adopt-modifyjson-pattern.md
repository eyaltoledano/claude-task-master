---
"task-master-ai": patch
---

Improve concurrency safety by adopting modifyJson pattern in file-storage

- Refactor saveTasks, createTag, deleteTag, renameTag to use modifyJson for atomic read-modify-write operations
- This prevents lost updates when multiple processes concurrently modify tasks.json
- Complements the cross-process file locking added in PR #1566
