# Why MCP Tools Use Zod v3

## Problem

- **FastMCP** uses `xsschema` to convert schemas → outputs JSON Schema **Draft 2020-12**
- **MCP clients** (Augment IDE, gemini-cli, etc.) only support **Draft-07**
- Using Zod v4 in tools causes "vendor undefined" errors and tool discovery failures

## Temporary Solution

All MCP tool files import from `zod/v3` instead of `zod`:

```javascript
import { z } from 'zod/v3';  // ✅ Draft-07 compatible
// NOT: import { z } from 'zod';  // ❌ Would use Draft 2020-12
```

### Why This Works

- Zod v4 ships with v3 compatibility at `zod/v3`
- FastMCP + zod-to-json-schema converts Zod v3 schemas → **Draft-07**
- This ensures MCP clients can discover and use our tools

### What This Means

- ✅ **MCP tools** → use `zod/v3` (this directory)
- ✅ **Rest of codebase** → uses `zod` (Zod v4)
- ✅ **No conflicts** → they're from the same package, just different versions

## When Can We Remove This?

This workaround can be removed when **either**:

1. **FastMCP adds JSON Schema version configuration**
   - e.g., `new FastMCP({ jsonSchema: { target: 'draft-07' } })`
   - Tracking: https://github.com/punkpeye/fastmcp/issues/189

2. **MCP spec adds Draft 2020-12 support**
   - Unlikely in the short term

3. **xsschema adds version targeting**
   - Would allow FastMCP to use Draft-07

## How to Maintain

When adding new MCP tools:

```javascript
// ✅ CORRECT
import { z } from 'zod/v3';

server.addTool({
  name: 'my_tool',
  parameters: z.object({ ... }),  // Will use Draft-07
  execute: async (args) => { ... }
});
```

```javascript
// ❌ WRONG - Will break MCP client compatibility
import { z } from 'zod';  // Don't do this in mcp-server/src/tools/
```

---

**Last Updated:** 2025-10-18
**Affects:** All files in `mcp-server/src/tools/`
