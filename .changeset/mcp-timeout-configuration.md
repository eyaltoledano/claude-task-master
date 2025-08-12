---
"task-master-ai": minor
---

Enhanced Roo Code profile with MCP timeout configuration for improved reliability during long-running AI operations. The Roo profile now automatically configures a 300-second timeout for MCP server operations, preventing timeouts during complex tasks like `parse-prd`, `expand-all`, `analyze-complexity`, and `research` operations. This change also replaces static MCP configuration files with programmatic generation for better maintainability.

**What's New:**
- 300-second timeout for MCP operations (up from default 30 seconds)
- Programmatic MCP configuration generation (replaces static asset files)
- Enhanced reliability for AI-powered operations
- Consistent with other AI coding assistant profiles

**Migration:** No user action required - existing Roo Code installations will automatically receive the enhanced MCP configuration on next initialization.