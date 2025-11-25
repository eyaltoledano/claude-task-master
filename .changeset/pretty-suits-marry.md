---
"task-master-ai": minor
---

Bring back `task-master generate` as a command and mcp tool (after popular demand)

- Generated files are now `.md` instead of `.txt`
  - They also follow the markdownlint format making them look like more standard md files
- added parameters to generate allowing you to generate with the `--tag` flag
  - If I am on an active tag and want to generate files from another tag, I can with the tag parameter
- See `task-master generate --help` for more information.
