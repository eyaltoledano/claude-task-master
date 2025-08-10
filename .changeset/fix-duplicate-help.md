---
"task-master-ai": patch
---

fix(cli): prevent duplicate help output by centralizing help rendering in the CLI wrapper (`bin/task-master.js`) so `task-master --help` prints once.
