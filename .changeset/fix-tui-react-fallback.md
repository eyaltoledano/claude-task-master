---
"task-master-ai": patch
---

Fix CLI startup without React installed by showing the existing help fallback when TUI mode is unavailable.

Keep CLI startup and builds compatible with Node 20.0 by loading the Gemini CLI SDK on demand, using portable JSON imports, and building with tsup.

Use a reproducible Gemini SDK compatibility snapshot with a narrow Google Core import so real Gemini clients, native structured output, and streaming work on Node 20.0 without loading unrelated CLI tools.
