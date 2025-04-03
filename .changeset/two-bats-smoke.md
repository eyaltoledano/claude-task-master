---
"task-master-ai": patch
---

- Adjusts the MCP server invokation in the mcp.json we ship with `task-master init`. Fully functional now.

- Rename MCP tools to better align with API conventions and natural language in client chat:
  - Rename `list-tasks` to `get-tasks` for more intuitive client requests like "get my tasks"
  - Rename `show-task` to `get-task` for consistency with GET-based API naming conventions

- **Optimize MCP response payloads:**
  - Add custom `processTaskResponse` function to `get-task` MCP tool to filter out unnecessary `allTasks` array data
  - Significantly reduce response size by returning only the specific requested task instead of all tasks
  - Preserve dependency status relationships for the UI/CLI while keeping MCP responses lean and efficient

- **Refactor project root handling for MCP Server:**
  - **Prioritize Session Roots**: MCP tools now extract the project root path directly from `session.roots[0].uri` provided by the client (e.g., Cursor).
  - **New Utility `getProjectRootFromSession`**: Added to `mcp-server/src/tools/utils.js` to encapsulate session root extraction and decoding. **Further refined for more reliable detection, especially in integrated environments, including deriving root from script path and avoiding fallback to '/'.**
  - **Simplify `findTasksJsonPath`**: The core path finding utility in `mcp-server/src/core/utils/path-utils.js` now prioritizes the `projectRoot` passed in `args` (originating from the session). Removed checks for `TASK_MASTER_PROJECT_ROOT` env var (we do not use this anymore) and package directory fallback. **Enhanced error handling to include detailed debug information (paths searched, CWD, server dir, etc.) and clearer potential solutions when `tasks.json` is not found.**
  - **Retain CLI Fallbacks**: Kept `lastFoundProjectRoot` cache check and CWD search in `findTasksJsonPath` for compatibility with direct CLI usage.

- Updated all MCP tools to use the new project root handling:
  - Tools now call `getProjectRootFromSession` to determine the root.
  - This root is passed explicitly as `projectRoot` in the `args` object to the corresponding `*Direct` function.
  - Direct functions continue to use the (now simplified) `findTasksJsonPath` to locate `tasks.json` within the provided root.
  - This ensures tools work reliably in integrated environments without requiring the user to specify `--project-root`.

- Add comprehensive PROJECT_MARKERS array for detecting common project files (used in CLI fallback logic).
- Improved error messages with specific troubleshooting guidance.
- **Enhanced logging:**
    - Indicate the source of project root selection more clearly.
    - **Add verbose logging in `get-task.js` to trace session object content and resolved project root path, aiding debugging.**

- DRY refactoring by centralizing path utilities in `core/utils/path-utils.js` and session handling in `tools/utils.js`.
- Keep caching of `lastFoundProjectRoot` for CLI performance.

- Split monolithic task-master-core.js into separate function files within direct-functions directory.
- Implement update-task MCP command for updating a single task by ID.
- Implement update-subtask MCP command for appending information to specific subtasks.
- Implement generate MCP command for creating individual task files from tasks.json.
- Implement set-status MCP command for updating task status.
- Implement get-task MCP command for displaying detailed task information (renamed from show-task).
- Implement next-task MCP command for finding the next task to work on.
- Implement expand-task MCP command for breaking down tasks into subtasks.
- Implement add-task MCP command for creating new tasks using AI assistance.
- Implement add-subtask MCP command for adding subtasks to existing tasks.
- Implement remove-subtask MCP command for removing subtasks from parent tasks.
- Implement expand-all MCP command for expanding all tasks into subtasks.
- Implement analyze-complexity MCP command for analyzing task complexity.
- Implement clear-subtasks MCP command for clearing subtasks from parent tasks.
- Implement remove-dependency MCP command for removing dependencies from tasks.
- Implement validate-dependencies MCP command for checking validity of task dependencies.
- Implement fix-dependencies MCP command for automatically fixing invalid dependencies.
- Implement complexity-report MCP command for displaying task complexity analysis reports.
- Implement add-dependency MCP command for creating dependency relationships between tasks.
- Implement get-tasks MCP command for listing all tasks (renamed from list-tasks).

- Enhance documentation and tool descriptions:
  - Create new `taskmaster.mdc` Cursor rule for comprehensive MCP tool and CLI command reference.
  - Bundle taskmaster.mdc with npm package and include in project initialization.
  - Add detailed descriptions for each tool's purpose, parameters, and common use cases.
  - Include natural language patterns and keywords for better intent recognition.
  - Document parameter descriptions with clear examples and default values.
  - Add usage examples and context for each command/tool.
  - **Update documentation (`mcp.mdc`, `utilities.mdc`, `architecture.mdc`, `new_features.mdc`, `commands.mdc`) to reflect the new session-based project root handling and the preferred MCP vs. CLI interaction model.**
  - Improve clarity around project root auto-detection in tool documentation.
  - Update tool descriptions to better reflect their actual behavior and capabilities.
  - Add cross-references between related tools and commands.
  - Include troubleshooting guidance in tool descriptions.
  - **Add default values for `DEFAULT_SUBTASKS` and `DEFAULT_PRIORITY` to the example `.cursor/mcp.json` configuration.**

- Document MCP server naming conventions in architecture.mdc and mcp.mdc files (file names use kebab-case, direct functions use camelCase with Direct suffix, tool registration functions use camelCase with Tool suffix, and MCP tool names use snake_case).
- Update MCP tool naming to follow more intuitive conventions that better align with natural language requests in client chat applications.
- Enhance task show view with a color-coded progress bar for visualizing subtask completion percentage.
- Add "cancelled" status to UI module status configurations for marking tasks as cancelled without deletion.
- Improve MCP server resource documentation with comprehensive implementation examples and best practices.
- Enhance progress bars with status breakdown visualization showing proportional sections for different task statuses.
- Add improved status tracking for both tasks and subtasks with detailed counts by status.
- Optimize progress bar display with width constraints to prevent UI overflow on smaller terminals.
- Improve status counts display with clear text labels beside status icons for better readability.
- Treat deferred and cancelled tasks as effectively complete for progress calculation while maintaining visual distinction.
- **Fix `reportProgress` calls** to use the correct `{ progress, total? }` format.
