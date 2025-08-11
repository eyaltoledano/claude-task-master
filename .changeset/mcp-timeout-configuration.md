---
"task-master-ai": minor
---

Add MCP timeout configuration for long-running operations

- Add timeout, disabled, and alwaysAllow configuration options to Roo Code MCP server setup
- Replace static mcp.json asset file with programmatic MCP configuration generation
- Enhance Roo profile to use standard MCP configuration creation with Roo-specific enhancements
- Update tests to reflect the new programmatic approach
- Remove duplicate static asset file to avoid code duplication

This change improves the reliability of MCP server operations by allowing configuration of timeout values for long-running AI operations, while maintaining consistency with other coding assistant profiles.