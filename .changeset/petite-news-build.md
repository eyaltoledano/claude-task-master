---
"task-master-ai": patch
---

Fix MCP server compatibility with Cursor IDE's latest update by upgrading to fastmcp v3.20.1 with Zod v4 support

- This resolves connection failures where the MCP server was unable to establish proper capability negotiation.
- Issue typically included wording like: `Server does not support completions`
