---
'task-master-ai': patch
---

Added flexible brand rules management:

- New `init` flag: You can now specify which brands to include rules for at project initialization using `--rules <brands>` or `-r <brands>` (e.g., `task-master init -r cursor,roo`). Only the selected brands' rules and configuration are included.
- New commands: `task-master rules add <brands>` and `task-master rules remove <brands>` let you add or remove brand-specific rules and MCP config after initialization, supporting multiple brands at once.
- Documentation and tests were updated to reflect these changes.

This enables more flexible, brand-specific project setups and makes rules management much easier.

- Resolves #338