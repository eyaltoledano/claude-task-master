---
"@tm/cli": minor
---

Add --ready and --blocking filters to list command for parallel team assignment

- Add `--ready` filter to show only tasks with satisfied dependencies (ready to work on)
- Add `--blocking` filter to show only tasks that block other tasks
- Combine `--ready --blocking` to find high-impact tasks (ready AND blocking others)
- Add "Blocks" column to task table showing which tasks depend on each task
- Blocks field included in JSON output for programmatic access
