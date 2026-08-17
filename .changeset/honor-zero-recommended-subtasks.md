---
"task-master-ai": patch
---

Honor a complexity-report recommendation of 0 subtasks instead of expanding to the default

`analyze-complexity` is asked to emit `recommendedSubtasks: 0` for tasks that need no breakdown, but `expand` discarded that value through a truthy check and generated `defaultSubtasks` (5) instead. Such tasks are now left alone, before any AI call is made, and `expand --all` reports them under its existing `skippedCount`. An explicit `--num` still overrides the report, including `--num=0` for dynamic generation.
