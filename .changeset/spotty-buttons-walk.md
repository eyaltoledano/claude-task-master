---
"task-master-ai": minor
---

Consolidate Task Master files into unified .taskmaster directory structure

This release introduces a new consolidated directory structure that organizes all Task Master files under a single `.taskmaster/` directory for better project organization and cleaner workspace management.

**New Directory Structure:**

- `.taskmaster/tasks/` - Task files (previously `tasks/`)
- `.taskmaster/docs/` - Documentation including PRD files (previously `scripts/`)
- `.taskmaster/reports/` - Complexity analysis reports (previously `scripts/`)
- `.taskmaster/templates/` - Template files like example PRD
- `.taskmaster/config.json` - Configuration (previously `.taskmasterconfig`)

**Migration & Backward Compatibility:**

- Existing projects continue to work with legacy file locations
- New projects use the consolidated structure automatically
- Run `task-master migrate` to move existing projects to the new structure
- All CLI commands and MCP tools automatically detect and use appropriate file locations

**Benefits:**

- Cleaner project root with Task Master files organized in one location
- Reduced file scatter across multiple directories
- Improved project navigation and maintenance
- Consistent file organization across all Task Master projects

This change maintains full backward compatibility while providing a migration path to the improved structure.
