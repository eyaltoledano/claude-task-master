---
"task-master-ai": minor
---

Add auto-detection for IDE profiles in rules command

- `tm rules add` now opens interactive setup with detected IDEs pre-selected
- `tm rules add -y` auto-detects and installs rules without prompting
- Detects 13 IDEs: Cursor, Claude Code, Windsurf, VS Code, Roo, Cline, Kiro, Zed, Kilo, Trae, Gemini, OpenCode, Codex
