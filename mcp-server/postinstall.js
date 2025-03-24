#!/usr/bin/env node

/**
 * Post-installation script for task-master-mcp
 * Displays helpful information after package installation
 */

console.error(`
✅ Task Master MCP Server has been installed!

To register the server with Cursor, run:
  npx task-master-mcp install

To start the server manually:
  npx task-master-mcp start

To use with Server-Sent Events transport:
  TRANSPORT_TYPE=sse npx task-master-mcp start

For installing globally:
  npm run install-global
  # or
  npm install -g && task-master-mcp install

For more information, run:
  npx task-master-mcp --help

Troubleshooting:
  If you have issues with transport configuration, try:
  - Ensure you have the correct FastMCP version (^1.20.5)
  - Double check your .cursor/mcp.json configuration
  - Run the server in debug mode with:
    DEBUG=* npx task-master-mcp start
`);
