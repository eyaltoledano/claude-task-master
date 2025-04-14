# task-master-ai

## 0.11.0

### Minor Changes

- [#71](https://github.com/eyaltoledano/claude-task-master/pull/71) [`7141062`](https://github.com/eyaltoledano/claude-task-master/commit/71410629ba187776d92a31ea0729b2ff341b5e38) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - - **Easier Ways to Use Taskmaster (CLI & MCP):**
  - You can now use Taskmaster either by installing it as a standard command-line tool (`task-master`) or as an MCP server directly within integrated development tools like Cursor (using its built-in features). **This makes Taskmaster accessible regardless of your preferred workflow.**
  - Setting up a new project is simpler in integrated tools, thanks to the new `initialize_project` capability.
  - **Complete MCP Implementation:**
    - NOTE: Many MCP clients charge on a per tool basis. In that regard, the most cost-efficient way to use Taskmaster is through the CLI directly. Otherwise, the MCP offers the smoothest and most recommended user experience.
    - All MCP tools now follow a standardized output format that mimicks RESTful API responses. They are lean JSON responses that are context-efficient. This is a net improvement over the last version which sent the whole CLI output directly, which needlessly wasted tokens.
    - Added a `remove-task` command to permanently delete tasks you no longer need.
    - Many new MCP tools are available for managing tasks (updating details, adding/removing subtasks, generating task files, setting status, finding the next task, breaking down complex tasks, handling dependencies, analyzing complexity, etc.), usable both from the command line and integrated tools. **(See the `taskmaster.mdc` reference guide and improved readme for a full list).**
  - **Better Task Tracking:**
    - Added a "cancelled" status option for tasks, providing more ways to categorize work.
  - **Smoother Experience in Integrated Tools:**
    - Long-running operations (like breaking down tasks or analysis) now run in the background **via an Async Operation Manager** with progress updates, so you know what's happening without waiting and can check status later.
  - **Improved Documentation:**
    - Added a comprehensive reference guide (`taskmaster.mdc`) detailing all commands and tools with examples, usage tips, and troubleshooting info. This is mostly for use by the AI but can be useful for human users as well.
    - Updated the main README with clearer instructions and added a new tutorial/examples guide.
    - Added documentation listing supported integrated tools (like Cursor).
  - **Increased Stability & Reliability:**
    - Using Taskmaster within integrated tools (like Cursor) is now **more stable and the recommended approach.**
    - Added automated testing (CI) to catch issues earlier, leading to a more reliable tool.
    - Fixed release process issues to ensure users get the correct package versions when installing or updating via npm.
  - **Better Command-Line Experience:**
    - Fixed bugs in the `expand-all` command that could cause **NaN errors or JSON formatting issues (especially when using `--research`).**
    - Fixed issues with parameter validation in the `analyze-complexity` command (specifically related to the `threshold` parameter).
    - Made the `add-task` command more consistent by adding standard flags like `--title`, `--description` for manual task creation so you don't have to use `--prompt` and can quickly drop new ideas and stay in your flow.
    - Improved error messages for incorrect commands or flags, making them easier to understand.
    - Added confirmation warnings before permanently deleting tasks (`remove-task`) to prevent mistakes. There's a known bug for deleting multiple tasks with comma-separated values. It'll be fixed next release.
    - Renamed some background tool names used by integrated tools (e.g., `list-tasks` is now `get_tasks`) to be more intuitive if seen in logs or AI interactions.
    - Smoother project start: **Improved the guidance provided to AI assistants immediately after setup** (related to `init` and `parse-prd` steps). This ensures the AI doesn't go on a tangent deciding its own workflow, and follows the exact process outlined in the Taskmaster workflow.
  - **Clearer Error Messages:**
    - When generating subtasks fails, error messages are now clearer, **including specific task IDs and potential suggestions.**
    - AI fallback from Claude to Perplexity now also works the other way around. If Perplexity is down, will switch to Claude.
  - **Simplified Setup & Configuration:**
    - Made it clearer how to configure API keys depending on whether you're using the command-line tool (`.env` file) or an integrated tool (`.cursor/mcp.json` file).
    - Taskmaster is now better at automatically finding your project files, especially in integrated tools, reducing the need for manual path settings.
    - Fixed an issue that could prevent Taskmaster from working correctly immediately after initialization in integrated tools (related to how the MCP server was invoked). This should solve the issue most users were experiencing with the last release (0.10.x)
    - Updated setup templates with clearer examples for API keys.
    - \*\*For advanced users setting up the MCP server manually, the command is now `npx -y task-master-ai task-master-mcp`.
  - **Enhanced Performance & AI:**
    - Updated underlying AI model settings:
      - **Increased Context Window:** Can now handle larger projects/tasks due to an increased Claude context window (64k -> 128k tokens).
      - **Reduced AI randomness:** More consistent and predictable AI outputs (temperature 0.4 -> 0.2).
      - **Updated default AI models:** Uses newer models like `claude-3-7-sonnet-20250219` and Perplexity `sonar-pro` by default.
      - **More granular breakdown:** Increased the default number of subtasks generated by `expand` to 5 (from 4).
      - **Consistent defaults:** Set the default priority for new tasks consistently to "medium".
    - Improved performance when viewing task details in integrated tools by sending less redundant data.
  - **Documentation Clarity:**
    - Clarified in documentation that Markdown files (`.md`) can be used for Product Requirements Documents (`parse_prd`).
    - Improved the description for the `numTasks` option in `parse_prd` for better guidance.
  - **Improved Visuals (CLI):**
    - Enhanced the look and feel of progress bars and status updates in the command line.
    - Added a helpful color-coded progress bar to the task details view (`show` command) to visualize subtask completion.
    - Made progress bars show a breakdown of task statuses (e.g., how many are pending vs. done).
    - Made status counts clearer with text labels next to icons.
    - Prevented progress bars from messing up the display on smaller terminal windows.
    - Adjusted how progress is calculated for 'deferred' and 'cancelled' tasks in the progress bar, while still showing their distinct status visually.
  - **Fixes for Integrated Tools:**
    - Fixed how progress updates are sent to integrated tools, ensuring they display correctly.
    - Fixed internal issues that could cause errors or invalid JSON responses when using Taskmaster with integrated tools.

## 0.10.1

### Patch Changes

- [#80](https://github.com/eyaltoledano/claude-task-master/pull/80) [`aa185b2`](https://github.com/eyaltoledano/claude-task-master/commit/aa185b28b248b4ca93f9195b502e2f5187868eaa) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Remove non-existent package `@model-context-protocol/sdk`

- [#45](https://github.com/eyaltoledano/claude-task-master/pull/45) [`757fd47`](https://github.com/eyaltoledano/claude-task-master/commit/757fd478d2e2eff8506ae746c3470c6088f4d944) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add license to repo

## 0.10.0

### Minor Changes

- [#44](https://github.com/eyaltoledano/claude-task-master/pull/44) [`eafdb47`](https://github.com/eyaltoledano/claude-task-master/commit/eafdb47418b444c03c092f653b438cc762d4bca8) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - add github actions to automate github and npm releases

- [#20](https://github.com/eyaltoledano/claude-task-master/pull/20) [`4eed269`](https://github.com/eyaltoledano/claude-task-master/commit/4eed2693789a444f704051d5fbb3ef8d460e4e69) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Implement MCP server for all commands using tools.

### Patch Changes

- [#44](https://github.com/eyaltoledano/claude-task-master/pull/44) [`44db895`](https://github.com/eyaltoledano/claude-task-master/commit/44db895303a9209416236e3d519c8a609ad85f61) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Added changeset config #39

- [#50](https://github.com/eyaltoledano/claude-task-master/pull/50) [`257160a`](https://github.com/eyaltoledano/claude-task-master/commit/257160a9670b5d1942e7c623bd2c1a3fde7c06a0) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix addTask tool `projectRoot not defined`

- [#57](https://github.com/eyaltoledano/claude-task-master/pull/57) [`9fd42ee`](https://github.com/eyaltoledano/claude-task-master/commit/9fd42eeafdc25a96cdfb70aa3af01f525d26b4bc) Thanks [@github-actions](https://github.com/apps/github-actions)! - fix mcp server not connecting to cursor

- [#48](https://github.com/eyaltoledano/claude-task-master/pull/48) [`5ec3651`](https://github.com/eyaltoledano/claude-task-master/commit/5ec3651e6459add7354910a86b3c4db4d12bc5d1) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix workflows
