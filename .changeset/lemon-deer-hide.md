---
'task-master-ai': minor
---

Added flexible rules management:

- New `init` flag: You can now specify which rules to include at project initialization using `--rules <rules>` or `-r <rules>` (e.g., `task-master init -r cursor,roo`). Only the selected rules and configuration are included.
- New commands: `task-master rules add <rules>` and `task-master rules remove <rules>` let you add or remove specific rules and MCP config after initialization, supporting multiple rules at once.
- New command: `task-master rules setup` launches an interactive prompt to select which rules to apply to your project. This does **not** re-initialize your project or affect shell aliases; it only manages rules. The list of rules is always up-to-date with available profiles, so you never have to update the CLI when adding a new rule set.
- The interactive rules setup flow is also used during `init` if you don't specify rules with `--rules`.
- Documentation and tests were updated to reflect these changes.

This enables more flexible, rule-specific project setups and makes rules management much easier. You can update or switch rules at any time after initialization using the interactive setup.

- Resolves #338