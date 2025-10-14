---
"task-master-ai": minor
---

Add configurable MCP tool loading to optimize LLM context usage

You can now control which Task Master MCP tools are loaded by setting the `TASK_MASTER_TOOLS` environment variable in your MCP configuration. This helps reduce context usage for LLMs by only loading the tools you need.

**Configuration Options:**

- `all` (default): Load all 36 tools
- `core` or `lean`: Load only 7 essential tools for daily development
  - Includes: `get_tasks`, `next_task`, `get_task`, `set_task_status`, `update_subtask`, `parse_prd`, `expand_task`
- `standard`: Load 15 commonly used tools (all core tools plus 8 more)
  - Additional tools: `initialize_project`, `analyze_project_complexity`, `expand_all`, `add_subtask`, `remove_task`, `generate`, `add_task`, `complexity_report`
- Custom list: Comma-separated tool names (e.g., `get_tasks,next_task,set_task_status`)

**Example .mcp.json configuration:**

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "env": {
        "TASK_MASTER_TOOLS": "standard",
        "ANTHROPIC_API_KEY": "your_key_here"
      }
    }
  }
}
```

For complete details on all available tools, configuration examples, and usage guidelines, see the [MCP Tools documentation](https://docs.task-master.dev/capabilities/mcp#configurable-tool-loading).
