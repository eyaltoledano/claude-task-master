---
"task-master-ai": minor
---

Add --ready and --blocking filters to list command for identifying parallelizable tasks

- Add `--ready` filter to show only tasks with satisfied dependencies (ready to work on)
- Add `--blocking` filter to show only tasks that block other tasks
- Combine `--ready --blocking` to find high-impact tasks (ready AND blocking others)
- Add "Blocks" column to task table showing which tasks depend on each task
- Blocks field included in JSON output for programmatic access
- Add "Ready" column to `tags` command showing count of ready tasks per tag
- Add `--ready` filter to `tags` command to show only tags with available work
- Excludes deferred/blocked tasks from ready count (only actionable statuses)
- Add `--all-tags` option to list ready tasks across all tags (use with `--ready`)
- Tag column shown as first column when using `--all-tags` for easy scanning
