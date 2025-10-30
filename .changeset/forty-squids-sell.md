---
"task-master-ai": patch
---

Fix subtask ID display to show full compound notation

When displaying a subtask via `tm show 104.1`, the header and properties table showed only the subtask's local ID (e.g., "1") instead of the full compound ID (e.g., "104.1"). The CLI now preserves and displays the original requested task ID throughout the display chain, ensuring subtasks are clearly identified with their parent context. Also improved TypeScript typing by using discriminated unions for Task/Subtask returns from `tasks.get()`, eliminating unsafe type coercions.
