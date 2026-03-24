---
"task-master-ai": patch
---

Fix complexity report losing results when running analyze-complexity with --from/--to ranges multiple times. Previous entries outside the current analysis range are now preserved across runs.
