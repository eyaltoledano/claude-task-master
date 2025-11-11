---
"task-master-ai": minor
---

Claude Code provider now respects your global, project, and local Claude Code configuration files.

When using the Claude Code AI provider, Task Master now automatically loads your Claude Code settings from:

- **Global config** (`~/.claude/` directory) - Your personal preferences across all projects
- **Project config** (`.claude/` directory) - Project-specific settings like CLAUDE.md instructions
- **Local config** - Workspace-specific overrides

This means your CLAUDE.md files, custom instructions, and Claude Code settings will now be properly applied when Task Master uses Claude Code as an AI provider. Previously, these settings were being ignored.

**What's improved:**

- ✅ CLAUDE.md files are now automatically loaded and applied (global and local)
- ✅ Your custom Claude Code settings are respected
- ✅ Project-specific instructions work as expected
- ✅ No manual configuration needed - works out of the box

**Issues:**
- Resolves #1391
- Resolves #1315