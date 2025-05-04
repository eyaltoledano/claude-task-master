# task-master-ai

## 0.13.1

### Patch Changes

- [#399](https://github.com/eyaltoledano/claude-task-master/pull/399) [`734a4fd`](https://github.com/eyaltoledano/claude-task-master/commit/734a4fdcfc89c2e089255618cf940561ad13a3c8) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix ERR_MODULE_NOT_FOUND when trying to run MCP Server

## 0.13.0

### Minor Changes

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`ef782ff`](https://github.com/eyaltoledano/claude-task-master/commit/ef782ff5bd4ceb3ed0dc9ea82087aae5f79ac933) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - feat(expand): Enhance `expand` and `expand-all` commands

  - Integrate `task-complexity-report.json` to automatically determine the number of subtasks and use tailored prompts for expansion based on prior analysis. You no longer need to try copy-pasting the recommended prompt. If it exists, it will use it for you. You can just run `task-master update --id=[id of task] --research` and it will use that prompt automatically. No extra prompt needed.
  - Change default behavior to _append_ new subtasks to existing ones. Use the `--force` flag to clear existing subtasks before expanding. This is helpful if you need to add more subtasks to a task but you want to do it by the batch from a given prompt. Use force if you want to start fresh with a task's subtasks.

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`87d97bb`](https://github.com/eyaltoledano/claude-task-master/commit/87d97bba00d84e905756d46ef96b2d5b984e0f38) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds support for the OpenRouter AI provider. Users can now configure models available through OpenRouter (requiring an `OPENROUTER_API_KEY`) via the `task-master models` command, granting access to a wide range of additional LLMs. - IMPORTANT FYI ABOUT OPENROUTER: Taskmaster relies on AI SDK, which itself relies on tool use. It looks like **free** models sometimes do not include tool use. For example, Gemini 2.5 pro (free) failed via OpenRouter (no tool use) but worked fine on the paid version of the model. Custom model support for Open Router is considered experimental and likely will not be further improved for some time.

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`1ab836f`](https://github.com/eyaltoledano/claude-task-master/commit/1ab836f191cb8969153593a9a0bd47fc9aa4a831) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds model management and new configuration file .taskmasterconfig which houses the models used for main, research and fallback. Adds models command and setter flags. Adds a --setup flag with an interactive setup. We should be calling this during init. Shows a table of active and available models when models is called without flags. Includes SWE scores and token costs, which are manually entered into the supported_models.json, the new place where models are defined for support. Config-manager.js is the core module responsible for managing the new config."

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`c8722b0`](https://github.com/eyaltoledano/claude-task-master/commit/c8722b0a7a443a73b95d1bcd4a0b68e0fce2a1cd) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds custom model ID support for Ollama and OpenRouter providers.

  - Adds the `--ollama` and `--openrouter` flags to `task-master models --set-<role>` command to set models for those providers outside of the support models list.
  - Updated `task-master models --setup` interactive mode with options to explicitly enter custom Ollama or OpenRouter model IDs.
  - Implemented live validation against OpenRouter API (`/api/v1/models`) when setting a custom OpenRouter model ID (via flag or setup).
  - Refined logic to prioritize explicit provider flags/choices over internal model list lookups in case of ID conflicts.
  - Added warnings when setting custom/unvalidated models.
  - We obviously don't recommend going with a custom, unproven model. If you do and find performance is good, please let us know so we can add it to the list of supported models.

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`2517bc1`](https://github.com/eyaltoledano/claude-task-master/commit/2517bc112c9a497110f3286ca4bfb4130c9addcb) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Integrate OpenAI as a new AI provider. - Enhance `models` command/tool to display API key status. - Implement model-specific `maxTokens` override based on `supported-models.json` to save you if you use an incorrect max token value.

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`9a48278`](https://github.com/eyaltoledano/claude-task-master/commit/9a482789f7894f57f655fb8d30ba68542bd0df63) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Tweaks Perplexity AI calls for research mode to max out input tokens and get day-fresh information - Forces temp at 0.1 for highly deterministic output, no variations - Adds a system prompt to further improve the output - Correctly uses the maximum input tokens (8,719, used 8,700) for perplexity - Specificies to use a high degree of research across the web - Specifies to use information that is as fresh as today; this support stuff like capturing brand new announcements like new GPT models and being able to query for those in research. 🔥

### Patch Changes

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`842eaf7`](https://github.com/eyaltoledano/claude-task-master/commit/842eaf722498ddf7307800b4cdcef4ac4fd7e5b0) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - - Add support for Google Gemini models via Vercel AI SDK integration.

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`ed79d4f`](https://github.com/eyaltoledano/claude-task-master/commit/ed79d4f4735dfab4124fa189214c0bd5e23a6860) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add xAI provider and Grok models support

- [#378](https://github.com/eyaltoledano/claude-task-master/pull/378) [`ad89253`](https://github.com/eyaltoledano/claude-task-master/commit/ad89253e313a395637aa48b9f92cc39b1ef94ad8) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Better support for file paths on Windows, Linux & WSL.

  - Standardizes handling of different path formats (URI encoded, Windows, Linux, WSL).
  - Ensures tools receive a clean, absolute path suitable for the server OS.
  - Simplifies tool implementation by centralizing normalization logic.

- [#285](https://github.com/eyaltoledano/claude-task-master/pull/285) [`2acba94`](https://github.com/eyaltoledano/claude-task-master/commit/2acba945c0afee9460d8af18814c87e80f747e9f) Thanks [@neno-is-ooo](https://github.com/neno-is-ooo)! - Add integration for Roo Code

- [#378](https://github.com/eyaltoledano/claude-task-master/pull/378) [`d63964a`](https://github.com/eyaltoledano/claude-task-master/commit/d63964a10eed9be17856757661ff817ad6bacfdc) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Improved update-subtask - Now it has context about the parent task details - It also has context about the subtask before it and the subtask after it (if they exist) - Not passing all subtasks to stay token efficient

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`5f504fa`](https://github.com/eyaltoledano/claude-task-master/commit/5f504fafb8bdaa0043c2d20dee8bbb8ec2040d85) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Improve and adjust `init` command for robustness and updated dependencies.

  - **Update Initialization Dependencies:** Ensure newly initialized projects (`task-master init`) include all required AI SDK dependencies (`@ai-sdk/*`, `ai`, provider wrappers) in their `package.json` for out-of-the-box AI feature compatibility. Remove unnecessary dependencies (e.g., `uuid`) from the init template.
  - **Silence `npm install` during `init`:** Prevent `npm install` output from interfering with non-interactive/MCP initialization by suppressing its stdio in silent mode.
  - **Improve Conditional Model Setup:** Reliably skip interactive `models --setup` during non-interactive `init` runs (e.g., `init -y` or MCP) by checking `isSilentMode()` instead of passing flags.
  - **Refactor `init.js`:** Remove internal `isInteractive` flag logic.
  - **Update `init` Instructions:** Tweak the "Getting Started" text displayed after `init`.
  - **Fix MCP Server Launch:** Update `.cursor/mcp.json` template to use `node ./mcp-server/server.js` instead of `npx task-master-mcp`.
  - **Update Default Model:** Change the default main model in the `.taskmasterconfig` template.

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`96aeeff`](https://github.com/eyaltoledano/claude-task-master/commit/96aeeffc195372722c6a07370540e235bfe0e4d8) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fixes an issue with add-task which did not use the manually defined properties and still needlessly hit the AI endpoint.

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`5aea93d`](https://github.com/eyaltoledano/claude-task-master/commit/5aea93d4c0490c242d7d7042a210611977848e0a) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fixes an issue that prevented remove-subtask with comma separated tasks/subtasks from being deleted (only the first ID was being deleted). Closes #140

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`66ac9ab`](https://github.com/eyaltoledano/claude-task-master/commit/66ac9ab9f66d006da518d6e8a3244e708af2764d) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Improves next command to be subtask-aware - The logic for determining the "next task" (findNextTask function, used by task-master next and the next_task MCP tool) has been significantly improved. Previously, it only considered top-level tasks, making its recommendation less useful when a parent task containing subtasks was already marked 'in-progress'. - The updated logic now prioritizes finding the next available subtask within any 'in-progress' parent task, considering subtask dependencies and priority. - If no suitable subtask is found within active parent tasks, it falls back to recommending the next eligible top-level task based on the original criteria (status, dependencies, priority).

  This change makes the next command much more relevant and helpful during the implementation phase of complex tasks.

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`ca7b045`](https://github.com/eyaltoledano/claude-task-master/commit/ca7b0457f1dc65fd9484e92527d9fd6d69db758d) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add `--status` flag to `show` command to filter displayed subtasks.

- [#328](https://github.com/eyaltoledano/claude-task-master/pull/328) [`5a2371b`](https://github.com/eyaltoledano/claude-task-master/commit/5a2371b7cc0c76f5e95d43921c1e8cc8081bf14e) Thanks [@knoxgraeme](https://github.com/knoxgraeme)! - Fix --task to --num-tasks in ui + related tests - issue #324

- [#240](https://github.com/eyaltoledano/claude-task-master/pull/240) [`6cb213e`](https://github.com/eyaltoledano/claude-task-master/commit/6cb213ebbd51116ae0688e35b575d09443d17c3b) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds a 'models' CLI and MCP command to get the current model configuration, available models, and gives the ability to set main/research/fallback models." - In the CLI, `task-master models` shows the current models config. Using the `--setup` flag launches an interactive set up that allows you to easily select the models you want to use for each of the three roles. Use `q` during the interactive setup to cancel the setup. - In the MCP, responses are simplified in RESTful format (instead of the full CLI output). The agent can use the `models` tool with different arguments, including `listAvailableModels` to get available models. Run without arguments, it will return the current configuration. Arguments are available to set the model for each of the three roles. This allows you to manage Taskmaster AI providers and models directly from either the CLI or MCP or both. - Updated the CLI help menu when you run `task-master` to include missing commands and .taskmasterconfig information. - Adds `--research` flag to `add-task` so you can hit up Perplexity right from the add-task flow, rather than having to add a task and then update it.

## 0.12.1

### Patch Changes

- [#307](https://github.com/eyaltoledano/claude-task-master/pull/307) [`2829194`](https://github.com/eyaltoledano/claude-task-master/commit/2829194d3c1dd5373d3bf40275cf4f63b12d49a7) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix add_dependency tool crashing the MCP Server

## 0.12.0

### Minor Changes

- [#253](https://github.com/eyaltoledano/claude-task-master/pull/253) [`b2ccd60`](https://github.com/eyaltoledano/claude-task-master/commit/b2ccd605264e47a61451b4c012030ee29011bb40) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add `npx task-master-ai` that runs mcp instead of using `task-master-mcp``

- [#267](https://github.com/eyaltoledano/claude-task-master/pull/267) [`c17d912`](https://github.com/eyaltoledano/claude-task-master/commit/c17d912237e6caaa2445e934fc48cd4841abf056) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve PRD parsing prompt with structured analysis and clearer task generation guidelines. We are testing a new prompt - please provide feedback on your experience.

### Patch Changes

- [#243](https://github.com/eyaltoledano/claude-task-master/pull/243) [`454a1d9`](https://github.com/eyaltoledano/claude-task-master/commit/454a1d9d37439c702656eedc0702c2f7a4451517) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - - Fixes shebang issue not allowing task-master to run on certain windows operating systems

  - Resolves #241 #211 #184 #193

- [#268](https://github.com/eyaltoledano/claude-task-master/pull/268) [`3e872f8`](https://github.com/eyaltoledano/claude-task-master/commit/3e872f8afbb46cd3978f3852b858c233450b9f33) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix remove-task command to handle multiple comma-separated task IDs

- [#239](https://github.com/eyaltoledano/claude-task-master/pull/239) [`6599cb0`](https://github.com/eyaltoledano/claude-task-master/commit/6599cb0bf9eccecab528207836e9d45b8536e5c2) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Updates the parameter descriptions for update, update-task and update-subtask to ensure the MCP server correctly reaches for the right update command based on what is being updated -- all tasks, one task, or a subtask.

- [#272](https://github.com/eyaltoledano/claude-task-master/pull/272) [`3aee9bc`](https://github.com/eyaltoledano/claude-task-master/commit/3aee9bc840eb8f31230bd1b761ed156b261cabc4) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Enhance the `parsePRD` to include `--append` flag. This flag allows users to append the parsed PRD to an existing file, making it easier to manage multiple PRD files without overwriting existing content.

- [#264](https://github.com/eyaltoledano/claude-task-master/pull/264) [`ff8e75c`](https://github.com/eyaltoledano/claude-task-master/commit/ff8e75cded91fb677903040002626f7a82fd5f88) Thanks [@joedanz](https://github.com/joedanz)! - Add quotes around numeric env vars in mcp.json (Windsurf, etc.)

- [#248](https://github.com/eyaltoledano/claude-task-master/pull/248) [`d99fa00`](https://github.com/eyaltoledano/claude-task-master/commit/d99fa00980fc61695195949b33dcda7781006f90) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - - Fix `task-master init` polluting codebase with new packages inside `package.json` and modifying project `README`

  - Now only initializes with cursor rules, windsurf rules, mcp.json, scripts/example_prd.txt, .gitignore modifications, and `README-task-master.md`

- [#266](https://github.com/eyaltoledano/claude-task-master/pull/266) [`41b979c`](https://github.com/eyaltoledano/claude-task-master/commit/41b979c23963483e54331015a86e7c5079f657e4) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fixed a bug that prevented the task-master from running in a Linux container

- [#265](https://github.com/eyaltoledano/claude-task-master/pull/265) [`0eb16d5`](https://github.com/eyaltoledano/claude-task-master/commit/0eb16d5ecbb8402d1318ca9509e9d4087b27fb25) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Remove the need for project name, description, and version. Since we no longer create a package.json for you

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
