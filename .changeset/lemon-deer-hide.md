---
'task-master-ai': minor
---

Added comprehensive rule profile management:

**New Profile Support**: Added comprehensive IDE profile support with eight specialized profiles: Claude Code, Cline, Codex, Cursor, Roo, Trae, VS Code, and Windsurf. Each profile is optimized for its respective IDE with appropriate mappings and configuration.
**Initialization**: You can now specify which rule profiles to include at project initialization using `--rules <profiles>` or `-r <profiles>` (e.g., `task-master init -r cursor,roo`). Only the selected profiles and configuration are included.
**Add/Remove Commands**: `task-master rules add <profiles>` and `task-master rules remove <profiles>` let you manage specific rule profiles and MCP config after initialization, supporting multiple profiles at once.
**Interactive Setup**: `task-master rules setup` launches an interactive prompt to select which rule profiles to add to your project. This does **not** re-initialize your project or affect shell aliases; it only manages rules.
**Selective Removal**: Rules removal intelligently preserves existing non-Task Master rules and files and only removes Task Master-specific rules. Profile directories are only removed when completely empty and all conditions are met (no existing rules, no other files/folders, MCP config completely removed).
**Safety Features**: Confirmation messages clearly explain that only Task Master-specific rules and MCP configurations will be removed, while preserving existing custom rules and other files.
**Robust Validation**: Includes comprehensive checks for array types in MCP config processing and error handling throughout the rules management system.

This enables more flexible, rule-specific project setups with intelligent cleanup that preserves user customizations while safely managing Task Master components.

- Resolves #338
