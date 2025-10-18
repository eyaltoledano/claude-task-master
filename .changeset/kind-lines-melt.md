---
"task-master-ai": patch
---

Fix MCP server compatibility with Draft-07 clients (Augment IDE, gemini-cli, gemini code assist)

- Resolves #1284

**Problem:**

- MCP tools were using Zod v4, which outputs JSON Schema Draft 2020-12
- MCP clients only support Draft-07
- Tools were not discoverable in gemini-cli and other clients

**Solution:**

- Updated all MCP tools to import from `zod/v3` instead of `zod`
- Zod v3 schemas convert to Draft-07 via FastMCP's zod-to-json-schema
- Fixed logger to use stderr instead of stdout (MCP protocol requirement)

This is a temporary workaround until FastMCP adds JSON Schema version configuration.
