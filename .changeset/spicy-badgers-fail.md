---
"task-master-ai": patch
---

Implement unified profile system for consistent rule profile handling

This major architectural improvement eliminates the distinction between "simple" and "complex" profiles, ensuring all profiles follow the same execution flow and lifecycle functions. Key improvements:

- **Fixed Claude MCP Integration**: Claude profile's `.claude` directory copying now works consistently in both CLI and MCP contexts
- **Unified Architecture**: All profiles now use the same `createProfile()` factory and execution flow
- **Consistent Lifecycle**: Every profile gets proper `onAdd`, `onRemove`, and `onPostConvert` lifecycle functions called
- **Improved Maintainability**: Removed complex branching logic for different profile types
- **Better Test Coverage**: All profiles now follow the same testing patterns

Technical changes include converting Claude and Codex profiles to use the base profile factory, unifying the rule transformer logic, and fixing MCP configuration path construction.
