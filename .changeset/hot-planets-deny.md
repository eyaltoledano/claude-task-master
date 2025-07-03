---
"task-master-ai": patch
---

Fix expand-task to use tag-specific complexity reports

The expand-task function now correctly uses complexity reports specific to the current tag context (e.g., task-complexity-report_feature-branch.json) instead of always using the default task-complexity-report.json file. This enables proper task expansion behavior when working with multiple tag contexts.
