---
'task-master-ai': patch
---

Improve and adjust `init` command for robustness and updated dependencies.

- **Update Initialization Dependencies:** Ensure newly initialized projects (`task-master init`) include all required AI SDK dependencies (`@ai-sdk/*`, `ai`, provider wrappers) in their `package.json` for out-of-the-box AI feature compatibility. Remove unnecessary dependencies (e.g., `uuid`) from the init template.
- **Silence `npm install` during `init`:** Prevent `npm install` output from interfering with non-interactive/MCP initialization by suppressing its stdio in silent mode.
- **Improve Conditional Model Setup:** Reliably skip interactive `models --setup` during non-interactive `init` runs (e.g., `init -y` or MCP) by checking `isSilentMode()` instead of passing flags.
- **Refactor `init.js`:** Remove internal `isInteractive` flag logic.
- **Update `init` Instructions:** Tweak the "Getting Started" text displayed after `init`.
- **Fix MCP Server Launch:** Update `.cursor/mcp.json` template to use `node ./mcp-server/server.js` instead of `npx task-master-mcp`.
- **Update Default Model:** Change the default main model in the `.taskmasterconfig` template.
