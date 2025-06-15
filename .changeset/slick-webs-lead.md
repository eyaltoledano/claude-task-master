---
"task-master-ai": minor
---

Research Save-to-File Feature & Critical MCP Tag Corruption Fix

**🔬 New Research Save-to-File Functionality:**

Added comprehensive save-to-file capability to the research command, enabling users to preserve research sessions for future reference and documentation.

**CLI Integration:**
- New `--save-file` flag for `task-master research` command
- Consistent with existing `--save` and `--save-to` flags for intuitive usage
- Interactive "Save to file" option in follow-up questions menu

**MCP Integration:**
- New `saveToFile` boolean parameter for the `research` MCP tool
- Enables programmatic research saving for AI agents and integrated tools

**File Management:**
- Automatically creates `.taskmaster/docs/research/` directory structure
- Generates timestamped, slugified filenames (e.g., `2025-01-13_what-is-typescript.md`)
- Comprehensive Markdown format with metadata headers including query, timestamp, and context sources
- Clean conversation history formatting without duplicate information

