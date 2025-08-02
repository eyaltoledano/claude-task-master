---
"task-master-ai": patch
---

Fix tag-specific complexity report detection in expand command

The expand command now correctly finds and uses tag-specific complexity reports (e.g., `task-complexity-report_feature-xyz.json`) when operating in a tag context. Previously, it would always look for the generic `task-complexity-report.json` file due to a default value in the CLI option definition.