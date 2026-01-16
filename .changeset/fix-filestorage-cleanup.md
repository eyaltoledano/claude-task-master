---
"task-master-ai": patch
---

Fix FileStorage resource leaks by ensuring close() is called in try/finally blocks
