---
"task-master-ai": patch
---

Make Docker sandbox mode opt-in for loop command

- Add `--sandbox` flag to `task-master loop` (default: use plain `claude -p`)
- Preserve progress.txt between runs (append instead of overwrite)
- Display execution mode in loop startup output
