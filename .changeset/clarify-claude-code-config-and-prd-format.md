---
"task-master-ai": patch
---

Improved documentation for Claude Code integration and PRD file formats.

**Claude Code Configuration Behavior:**

Clarified how Task Master interacts with Claude Code's `.claude` configuration files. The documentation now explains:

- When Task Master uses your global `~/.claude/settings.json` and project `.mcp.json` files (when `claudeCode.mcpServers` is NOT configured in `.taskmaster/config.json`)
- When these files are ignored (when `claudeCode.mcpServers` IS explicitly configured)
- Configuration precedence rules
- Three practical examples for different usage scenarios

This resolves confusion about whether Task Master respects your existing Claude Code setup or requires separate configuration.

**PRD File Format Recommendation:**

Updated all documentation to recommend using `.md` (Markdown) extension for PRD files instead of `.txt`. While both formats work, `.md` provides:

- Syntax highlighting in editors
- Proper rendering when previewing in VS Code, GitHub, and other tools
- Better collaboration through formatted documentation

All examples now use `prd.md` instead of `prd.txt`, and the benefits are clearly explained in the Claude Code integration guide.

Related: #1180
