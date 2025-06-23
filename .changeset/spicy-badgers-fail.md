---
"task-master-ai": patch
---

Implement unified profile system for consistent rule profile handling

This architectural improvement eliminates the distinction between "simple" and "complex" profiles. All profiles now follow the same execution flow with shared default configurations.

**Major Improvements:**

- **Unified Architecture**: All profiles now use the same `createProfile()` factory and execution flow
- **DRY File Mapping**: Standard profiles (Cline, Roo, Trae, VS Code, Windsurf) now share a default fileMap from `base-profile.js`, eliminating duplicated configuration
- **Smart Default Generation**: Automatic generation of profile-specific rule filenames (e.g., `cursor_rules.mdc` → `roo_rules.md`) using `${name.toLowerCase()}_rules${targetExtension}`
- **Optimized Path Resolution**: Removed redundant dual-path checking logic, replacing it with explicit path specifications for better performance
- **Consistent Lifecycle**: Every profile gets proper `onAdd`, `onRemove`, and `onPostConvert` lifecycle functions called
- **Specialized Profile Support**: Claude and Codex profiles maintain their minimal fileMaps for specific use cases (AGENTS.md only)

**Technical Changes:**

- Converted Claude and Codex profiles to use the base profile factory
- Unified rule transformer logic with explicit path mapping
- Fixed MCP configuration path construction
- Eliminated `customFileMap` in favor of unified `fileMap` architecture
- Simplified base profile factory logic by removing obsolete asset-only profile handling

**Maintainability Benefits:**

- Reduced code duplication across profile configurations
- Centralized default file mapping logic
- Simplified profile creation and maintenance
- Better test coverage with consistent patterns
- Cleaner, more predictable codebase structure
