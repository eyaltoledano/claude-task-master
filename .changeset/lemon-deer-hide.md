---
'task-master-ai': patch
---

Added flexible brand rules management:

- New `init` flag: You can now specify which brands to include rules for at project initialization using `--rules <brands>` or `-r <brands>` (e.g., `task-master init -r cursor,roo`). Only the selected brands' rules and configuration are included.
- New commands: `task-master rules add <brands>` and `task-master rules remove <brands>` let you add or remove brand-specific rules and MCP config after initialization, supporting multiple brands at once.
- New command: `task-master rules setup` launches an interactive prompt to select which brand rules to apply to your project. This does **not** re-initialize your project or affect shell aliases; it only manages rules. The list of brands is always up-to-date with available profiles, so you never have to update the CLI when adding a new brand.
- The interactive rules setup flow is also used during `init` if you don't specify brands with `--rules`.
- Documentation and tests were updated to reflect these changes.

This enables more flexible, brand-specific project setups and makes rules management much easier. You can update or switch brands at any time after initialization using the interactive setup.

- Resolves #338