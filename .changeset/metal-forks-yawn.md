---
'task-master-ai': minor
---

Enhance analyze-complexity to support analyzing specific task IDs. 
    - You can now analyze individual tasks or selected task groups by using the new `--id` option with comma-separated IDs, or `--from` and `--to` options to specify a range of tasks. 
    - The feature intelligently merges analysis results with existing reports, allowing incremental analysis while preserving previous results.
