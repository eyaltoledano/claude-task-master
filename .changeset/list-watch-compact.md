---
"task-master-ai": minor
---

Add watch mode and compact output to list command

- Add `-w/--watch` flag to continuously monitor task changes with real-time updates
- Add `-c/--compact` flag for minimal task output format
- Add `--no-header` flag to hide the command header
- Support file-based watching via fs.watch for local tasks.json
- Support API-based watching via Supabase Realtime for authenticated users
- Display last sync timestamp and source in watch mode
