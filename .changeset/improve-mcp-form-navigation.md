---
"task-master-ai": patch
---

Improve MCP server management form navigation and add paste configuration support

- Add bidirectional form navigation with arrow keys and Shift+Tab
- Add explicit cancel button in addition to ESC key for better UX
- Add paste mode ('p' key) to quickly import MCP server configurations from JSON
- Support standard MCP server format used by most providers
- Allow pasting multiple servers at once
- Automatically detect transport type (stdio, sse, http) from configuration
- Improve keyboard shortcut hints throughout MCP management screens
- Fix server creation bug by ensuring unique IDs are generated before saving
- Enhance server details page with comprehensive debug information:
  - Show server ID and creation timestamp
  - Display full command line for stdio servers
  - List all arguments and environment variables
  - Show headers for HTTP/SSE servers
  - Display any error messages for troubleshooting
- Fix MCP server connection handling to properly support command-based servers (npx, uvx, etc.)
  - Update client to handle both scriptPath and command configurations
  - Pass environment variables correctly to spawned processes
  - Add debug logging for launched commands 