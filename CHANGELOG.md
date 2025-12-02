# task-master-ai

## 0.36.0

### Minor Changes

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add Hamster integration for `parse-prd` command

  Your tasks are only as good as the context behind them. Now when you run `parse-prd`, you can choose to bring your PRD to Hamster instead of parsing locally.

  **New Workflow Choice**
  - **Parse locally**: PRD becomes a task list in a local JSON file - great for quick prototyping and vibing solo
  - **Bring it to Hamster**: PRD becomes a living brief connected to your team, codebase, and agents

  **Why Hamster?**
  - Tasks live in a central place with real-time sync across your team
  - Collaborate on your PRD/brief together, generate tasks on Hamster, bring them into Taskmaster
  - No API keys needed - Hamster handles all AI inference, just need a Hamster account

  **Hamster Integration**
  - OAuth login flow when choosing Hamster (same as export command)
  - Create brief directly from PRD content with auto-generated title/description
  - Progress bar showing task generation phases (analyzing → generating → processing)
  - Invite teammates during brief creation
  - Auto-set context to new brief when complete

  **Quality of Life**
  - Clickable brief URL and team invite URL in terminal
  - Shows task count as they're generated
  - Graceful fallback if generation takes longer than expected

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Redesign `tm init` with clearer workflow selection and reduced noise

  Choose how you want to plan: Solo with Taskmaster or Together with Hamster. The new init flow guides you through setup with context-appropriate options and cleaner output.

  **New Workflow Selection**
  - Clear framing: "You need a plan before you execute. How do you want to build it?"
  - **Solo (Taskmaster)**: Parse PRD → structured tasks → AI agent executes with control
  - **Together (Hamster)**: Team writes brief → Hamster refines → aligned execution with Taskmaster

  **Cleaner Experience**
  - Optional AI IDE rules setup (Y/n prompt instead of always showing)
  - 15+ log messages moved to debug level - much less noise
  - Skip Git prompts when using Hamster (not needed for cloud storage)
  - Skip AI model configuration for Hamster (uses Hamster's AI)

  **Hamster Integration**
  - OAuth login flow when choosing Hamster workflow
  - Context-aware guidance based on your workflow choice

  **Quality of Life**
  - Run `tm rules --setup` anytime if you declined during init
  - Use `--yes` flag for fully non-interactive setup
  - Use `--rules cursor,windsurf` to specify rules upfront

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Introduce `tm export` command - bring Task Master to your team

  Share your task plans with teammates by exporting local tasks to collaborative briefs on Hamster. Select which tags to export, invite team members, and start collaborating instantly.

  **New `tm export` Command**
  - Export your local tasks to shareable team briefs
  - Hamster will reverse engineer your PRD based on your tasks (reverse parse prd!)
  - Select multiple tags to export in one go, import all tasks across tags to Hamster
  - Hamster will generate brief titles and descriptions from your task content
  - Automatically sets your CLI context to the new brief
  - All AI calls handled by Hamster, zero API keys needed - just a Hamster account!

  **Team Collaboration**
  - Invite teammates during export with `-I, --invite` flag
  - Add up to 10 team members by email
  - See invitation status: sent, already a member, or error

  **Quality of Life Improvements**
  - New `tm login` / `tm logout` shortcuts
  - Display ID shortcuts: `tm show ham31` now works (normalizes to HAM-31)
  - Better task rendering with proper HTML/Markdown support

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add simpler positional syntax and Hamster-aware UI improvements
  - **Simpler command syntax**: Use positional arguments without flags
    - `tm update-task 1 Added implementation` (no quotes needed for multi-word prompts)
    - `tm status 1 done` (new alias for set-status) or `tm set-status 1,1.1,2 in-progress`
    - `tm list done` or `tm list in-progress` or `tm list all` (shortcut for --with-subtasks)
  - **Hamster-aware help**: Context-specific command list when connected to Hamster
    - Shows only relevant commands for Hamster workflow
    - Beautiful boxed section headers with improved spacing
    - Clear usage examples with new positional syntax
    - Better visual alignment and cleaner formatting
  - **Progress indicators**: Added loading spinner to `update-task` when connected to Hamster
    - Shows "Updating task X on Hamster..." during AI processing
    - Cleaner, more responsive UX for long-running operations
  - **Improved context display**: Show 'Brief: [name]' instead of 'tag: [name]' when connected to Hamster
  - **Cleaner Hamster updates**: Simplified update display (removed redundant Mode/Prompt info)
  - **Smart messaging**: "NO TASKS AVAILABLE" warning only shows when literally no tasks exist
    - Removed misleading messages when tasks are just completed/in-progress/blocked
    - Better UX for filtered task lists
  - **Updated help everywhere**: Regular help menu now shows new positional argument syntax
    - All suggested actions updated across commands
    - Consistent syntax in all UI components
  - **Auto-detection**: Automatically detects Hamster connection for better UX
  - **Backward compatible**: All old flag syntax still works (`--id`, `--status`, etc.)

### Patch Changes

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add Sentry integration for error tracking and AI telemetry monitoring
  - **Sentry Integration**: Added comprehensive error tracking and AI operation monitoring using Sentry with Vercel AI SDK integration
  - **AI Telemetry**: All AI operations (generateText, streamText, generateObject, streamObject) now automatically track spans, token usage, prompts, and responses
  - **MCP Server Instrumentation**: Wrapped FastMCP server with `Sentry.wrapMcpServerWithSentry()` to automatically capture spans for all MCP tool interactions
  - **Privacy Controls**: Added `anonymousTelemetry` config option (default: true) allowing local storage users to opt out of telemetry
  - **Complete Coverage**: Telemetry enabled for all AI commands including parse-prd, expand, update-task, analyze-complexity, and research
  - **Internal Telemetry**: Sentry DSN is hardcoded internally for Task Master's telemetry (not user-configurable)
  - **Dual Initialization**: Automatic Sentry initialization in both CLI (scripts/dev.js) and MCP Server (mcp-server/src/index.js) with full MCP instrumentation

- [#1463](https://github.com/eyaltoledano/claude-task-master/pull/1463) [`55595f6`](https://github.com/eyaltoledano/claude-task-master/commit/55595f680c8b52b5421d3e0c7640bf2050efe44f) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix package issue in earlier rc

## 0.36.0-rc.3

### Minor Changes

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add Hamster integration for `parse-prd` command

  Your tasks are only as good as the context behind them. Now when you run `parse-prd`, you can choose to bring your PRD to Hamster instead of parsing locally.

  **New Workflow Choice**
  - **Parse locally**: PRD becomes a task list in a local JSON file - great for quick prototyping and vibing solo
  - **Bring it to Hamster**: PRD becomes a living brief connected to your team, codebase, and agents

  **Why Hamster?**
  - Tasks live in a central place with real-time sync across your team
  - Collaborate on your PRD/brief together, generate tasks on Hamster, bring them into Taskmaster
  - No API keys needed - Hamster handles all AI inference, just need a Hamster account

  **Hamster Integration**
  - OAuth login flow when choosing Hamster (same as export command)
  - Create brief directly from PRD content with auto-generated title/description
  - Progress bar showing task generation phases (analyzing → generating → processing)
  - Invite teammates during brief creation
  - Auto-set context to new brief when complete

  **Quality of Life**
  - Clickable brief URL and team invite URL in terminal
  - Shows task count as they're generated
  - Graceful fallback if generation takes longer than expected

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Redesign `tm init` with clearer workflow selection and reduced noise

  Choose how you want to plan: Solo with Taskmaster or Together with Hamster. The new init flow guides you through setup with context-appropriate options and cleaner output.

  **New Workflow Selection**
  - Clear framing: "You need a plan before you execute. How do you want to build it?"
  - **Solo (Taskmaster)**: Parse PRD → structured tasks → AI agent executes with control
  - **Together (Hamster)**: Team writes brief → Hamster refines → aligned execution with Taskmaster

  **Cleaner Experience**
  - Optional AI IDE rules setup (Y/n prompt instead of always showing)
  - 15+ log messages moved to debug level - much less noise
  - Skip Git prompts when using Hamster (not needed for cloud storage)
  - Skip AI model configuration for Hamster (uses Hamster's AI)

  **Hamster Integration**
  - OAuth login flow when choosing Hamster workflow
  - Context-aware guidance based on your workflow choice

  **Quality of Life**
  - Run `tm rules --setup` anytime if you declined during init
  - Use `--yes` flag for fully non-interactive setup
  - Use `--rules cursor,windsurf` to specify rules upfront

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Introduce `tm export` command - bring Task Master to your team

  Share your task plans with teammates by exporting local tasks to collaborative briefs on Hamster. Select which tags to export, invite team members, and start collaborating instantly.

  **New `tm export` Command**
  - Export your local tasks to shareable team briefs
  - Hamster will reverse engineer your PRD based on your tasks (reverse parse prd!)
  - Select multiple tags to export in one go, import all tasks across tags to Hamster
  - Hamster will generate brief titles and descriptions from your task content
  - Automatically sets your CLI context to the new brief
  - All AI calls handled by Hamster, zero API keys needed - just a Hamster account!

  **Team Collaboration**
  - Invite teammates during export with `-I, --invite` flag
  - Add up to 10 team members by email
  - See invitation status: sent, already a member, or error

  **Quality of Life Improvements**
  - New `tm login` / `tm logout` shortcuts
  - Display ID shortcuts: `tm show ham31` now works (normalizes to HAM-31)
  - Better task rendering with proper HTML/Markdown support

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add simpler positional syntax and Hamster-aware UI improvements
  - **Simpler command syntax**: Use positional arguments without flags
    - `tm update-task 1 Added implementation` (no quotes needed for multi-word prompts)
    - `tm status 1 done` (new alias for set-status) or `tm set-status 1,1.1,2 in-progress`
    - `tm list done` or `tm list in-progress` or `tm list all` (shortcut for --with-subtasks)
  - **Hamster-aware help**: Context-specific command list when connected to Hamster
    - Shows only relevant commands for Hamster workflow
    - Beautiful boxed section headers with improved spacing
    - Clear usage examples with new positional syntax
    - Better visual alignment and cleaner formatting
  - **Progress indicators**: Added loading spinner to `update-task` when connected to Hamster
    - Shows "Updating task X on Hamster..." during AI processing
    - Cleaner, more responsive UX for long-running operations
  - **Improved context display**: Show 'Brief: [name]' instead of 'tag: [name]' when connected to Hamster
  - **Cleaner Hamster updates**: Simplified update display (removed redundant Mode/Prompt info)
  - **Smart messaging**: "NO TASKS AVAILABLE" warning only shows when literally no tasks exist
    - Removed misleading messages when tasks are just completed/in-progress/blocked
    - Better UX for filtered task lists
  - **Updated help everywhere**: Regular help menu now shows new positional argument syntax
    - All suggested actions updated across commands
    - Consistent syntax in all UI components
  - **Auto-detection**: Automatically detects Hamster connection for better UX
  - **Backward compatible**: All old flag syntax still works (`--id`, `--status`, etc.)

### Patch Changes

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add Sentry integration for error tracking and AI telemetry monitoring
  - **Sentry Integration**: Added comprehensive error tracking and AI operation monitoring using Sentry with Vercel AI SDK integration
  - **AI Telemetry**: All AI operations (generateText, streamText, generateObject, streamObject) now automatically track spans, token usage, prompts, and responses
  - **MCP Server Instrumentation**: Wrapped FastMCP server with `Sentry.wrapMcpServerWithSentry()` to automatically capture spans for all MCP tool interactions
  - **Privacy Controls**: Added `anonymousTelemetry` config option (default: true) allowing local storage users to opt out of telemetry
  - **Complete Coverage**: Telemetry enabled for all AI commands including parse-prd, expand, update-task, analyze-complexity, and research
  - **Internal Telemetry**: Sentry DSN is hardcoded internally for Task Master's telemetry (not user-configurable)
  - **Dual Initialization**: Automatic Sentry initialization in both CLI (scripts/dev.js) and MCP Server (mcp-server/src/index.js) with full MCP instrumentation

- [#1463](https://github.com/eyaltoledano/claude-task-master/pull/1463) [`55595f6`](https://github.com/eyaltoledano/claude-task-master/commit/55595f680c8b52b5421d3e0c7640bf2050efe44f) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix package issue in earlier rc

## 0.36.0

### Minor Changes

- [#1446](https://github.com/eyaltoledano/claude-task-master/pull/1446) [`2316e94`](https://github.com/eyaltoledano/claude-task-master/commit/2316e94b288915bb906e1a61a87f59e291594fef) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Bring back `task-master generate` as a command and mcp tool (after popular demand)
  - Generated files are now `.md` instead of `.txt`
    - They also follow the markdownlint format making them look like more standard md files
  - added parameters to generate allowing you to generate with the `--tag` flag
    - If I am on an active tag and want to generate files from another tag, I can with the tag parameter
  - See `task-master generate --help` for more information.

- [#1454](https://github.com/eyaltoledano/claude-task-master/pull/1454) [`38ff7eb`](https://github.com/eyaltoledano/claude-task-master/commit/38ff7ebbc029919ea4cd5257573efbf1ea2f0eeb) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Hamster rules to task-master rules

## 0.36.0

### Minor Changes

- [#1446](https://github.com/eyaltoledano/claude-task-master/pull/1446) [`2316e94`](https://github.com/eyaltoledano/claude-task-master/commit/2316e94b288915bb906e1a61a87f59e291594fef) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Bring back `task-master generate` as a command and mcp tool (after popular demand)
  - Generated files are now `.md` instead of `.txt`
    - They also follow the markdownlint format making them look like more standard md files
  - added parameters to generate allowing you to generate with the `--tag` flag
    - If I am on an active tag and want to generate files from another tag, I can with the tag parameter
  - See `task-master generate --help` for more information.

- [#1454](https://github.com/eyaltoledano/claude-task-master/pull/1454) [`38ff7eb`](https://github.com/eyaltoledano/claude-task-master/commit/38ff7ebbc029919ea4cd5257573efbf1ea2f0eeb) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Hamster rules to task-master rules

## 0.36.0-rc.2

### Patch Changes

- [#1463](https://github.com/eyaltoledano/claude-task-master/pull/1463) [`55595f6`](https://github.com/eyaltoledano/claude-task-master/commit/55595f680c8b52b5421d3e0c7640bf2050efe44f) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix package issue in earlier rc

## 0.36.0-rc.1

### Minor Changes

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add Hamster integration for `parse-prd` command

  Your tasks are only as good as the context behind them. Now when you run `parse-prd`, you can choose to bring your PRD to Hamster instead of parsing locally.

  **New Workflow Choice**
  - **Parse locally**: PRD becomes a task list in a local JSON file - great for quick prototyping and vibing solo
  - **Bring it to Hamster**: PRD becomes a living brief connected to your team, codebase, and agents

  **Why Hamster?**
  - Tasks live in a central place with real-time sync across your team
  - Collaborate on your PRD/brief together, generate tasks on Hamster, bring them into Taskmaster
  - No API keys needed - Hamster handles all AI inference, just need a Hamster account

  **Hamster Integration**
  - OAuth login flow when choosing Hamster (same as export command)
  - Create brief directly from PRD content with auto-generated title/description
  - Progress bar showing task generation phases (analyzing → generating → processing)
  - Invite teammates during brief creation
  - Auto-set context to new brief when complete

  **Quality of Life**
  - Clickable brief URL and team invite URL in terminal
  - Shows task count as they're generated
  - Graceful fallback if generation takes longer than expected

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Redesign `tm init` with clearer workflow selection and reduced noise

  Choose how you want to plan: Solo with Taskmaster or Together with Hamster. The new init flow guides you through setup with context-appropriate options and cleaner output.

  **New Workflow Selection**
  - Clear framing: "You need a plan before you execute. How do you want to build it?"
  - **Solo (Taskmaster)**: Parse PRD → structured tasks → AI agent executes with control
  - **Together (Hamster)**: Team writes brief → Hamster refines → aligned execution with Taskmaster

  **Cleaner Experience**
  - Optional AI IDE rules setup (Y/n prompt instead of always showing)
  - 15+ log messages moved to debug level - much less noise
  - Skip Git prompts when using Hamster (not needed for cloud storage)
  - Skip AI model configuration for Hamster (uses Hamster's AI)

  **Hamster Integration**
  - OAuth login flow when choosing Hamster workflow
  - Context-aware guidance based on your workflow choice

  **Quality of Life**
  - Run `tm rules --setup` anytime if you declined during init
  - Use `--yes` flag for fully non-interactive setup
  - Use `--rules cursor,windsurf` to specify rules upfront

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Introduce `tm export` command - bring Task Master to your team

  Share your task plans with teammates by exporting local tasks to collaborative briefs on Hamster. Select which tags to export, invite team members, and start collaborating instantly.

  **New `tm export` Command**
  - Export your local tasks to shareable team briefs
  - Hamster will reverse engineer your PRD based on your tasks (reverse parse prd!)
  - Select multiple tags to export in one go, import all tasks across tags to Hamster
  - Hamster will generate brief titles and descriptions from your task content
  - Automatically sets your CLI context to the new brief
  - All AI calls handled by Hamster, zero API keys needed - just a Hamster account!

  **Team Collaboration**
  - Invite teammates during export with `-I, --invite` flag
  - Add up to 10 team members by email
  - See invitation status: sent, already a member, or error

  **Quality of Life Improvements**
  - New `tm login` / `tm logout` shortcuts
  - Display ID shortcuts: `tm show ham31` now works (normalizes to HAM-31)
  - Better task rendering with proper HTML/Markdown support

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add simpler positional syntax and Hamster-aware UI improvements
  - **Simpler command syntax**: Use positional arguments without flags
    - `tm update-task 1 Added implementation` (no quotes needed for multi-word prompts)
    - `tm status 1 done` (new alias for set-status) or `tm set-status 1,1.1,2 in-progress`
    - `tm list done` or `tm list in-progress` or `tm list all` (shortcut for --with-subtasks)
  - **Hamster-aware help**: Context-specific command list when connected to Hamster
    - Shows only relevant commands for Hamster workflow
    - Beautiful boxed section headers with improved spacing
    - Clear usage examples with new positional syntax
    - Better visual alignment and cleaner formatting
  - **Progress indicators**: Added loading spinner to `update-task` when connected to Hamster
    - Shows "Updating task X on Hamster..." during AI processing
    - Cleaner, more responsive UX for long-running operations
  - **Improved context display**: Show 'Brief: [name]' instead of 'tag: [name]' when connected to Hamster
  - **Cleaner Hamster updates**: Simplified update display (removed redundant Mode/Prompt info)
  - **Smart messaging**: "NO TASKS AVAILABLE" warning only shows when literally no tasks exist
    - Removed misleading messages when tasks are just completed/in-progress/blocked
    - Better UX for filtered task lists
  - **Updated help everywhere**: Regular help menu now shows new positional argument syntax
    - All suggested actions updated across commands
    - Consistent syntax in all UI components
  - **Auto-detection**: Automatically detects Hamster connection for better UX
  - **Backward compatible**: All old flag syntax still works (`--id`, `--status`, etc.)

### Patch Changes

- [#1452](https://github.com/eyaltoledano/claude-task-master/pull/1452) [`4046b3c`](https://github.com/eyaltoledano/claude-task-master/commit/4046b3ca4479adf0239679eb5ba18b7b4aec0749) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add Sentry integration for error tracking and AI telemetry monitoring
  - **Sentry Integration**: Added comprehensive error tracking and AI operation monitoring using Sentry with Vercel AI SDK integration
  - **AI Telemetry**: All AI operations (generateText, streamText, generateObject, streamObject) now automatically track spans, token usage, prompts, and responses
  - **MCP Server Instrumentation**: Wrapped FastMCP server with `Sentry.wrapMcpServerWithSentry()` to automatically capture spans for all MCP tool interactions
  - **Privacy Controls**: Added `anonymousTelemetry` config option (default: true) allowing local storage users to opt out of telemetry
  - **Complete Coverage**: Telemetry enabled for all AI commands including parse-prd, expand, update-task, analyze-complexity, and research
  - **Internal Telemetry**: Sentry DSN is hardcoded internally for Task Master's telemetry (not user-configurable)
  - **Dual Initialization**: Automatic Sentry initialization in both CLI (scripts/dev.js) and MCP Server (mcp-server/src/index.js) with full MCP instrumentation

## 0.36.0-rc.0

### Minor Changes

- [#1446](https://github.com/eyaltoledano/claude-task-master/pull/1446) [`2316e94`](https://github.com/eyaltoledano/claude-task-master/commit/2316e94b288915bb906e1a61a87f59e291594fef) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Bring back `task-master generate` as a command and mcp tool (after popular demand)
  - Generated files are now `.md` instead of `.txt`
    - They also follow the markdownlint format making them look like more standard md files
  - added parameters to generate allowing you to generate with the `--tag` flag
    - If I am on an active tag and want to generate files from another tag, I can with the tag parameter
  - See `task-master generate --help` for more information.

- [#1454](https://github.com/eyaltoledano/claude-task-master/pull/1454) [`38ff7eb`](https://github.com/eyaltoledano/claude-task-master/commit/38ff7ebbc029919ea4cd5257573efbf1ea2f0eeb) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Hamster rules to task-master rules

## 0.35.0

### Minor Changes

- [#1437](https://github.com/eyaltoledano/claude-task-master/pull/1437) [`783398e`](https://github.com/eyaltoledano/claude-task-master/commit/783398ecdf71432bd2b97f400756acbcfd60fbef) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Upgrade gemini-cli provider to native structured output support
  - Upgrade `ai-sdk-provider-gemini-cli` from v1.1.1 to v1.4.0 with native `responseJsonSchema` support
  - Simplify provider implementation by removing JSON extraction workarounds (652 lines → 95 lines)
  - Enable native structured output via Gemini API's schema enforcement

- [#1440](https://github.com/eyaltoledano/claude-task-master/pull/1440) [`9f6f3af`](https://github.com/eyaltoledano/claude-task-master/commit/9f6f3affe322512a8708624850c144b4b890e782) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add support for opus 4.1 and opus 4.5 anthropic models

### Patch Changes

- [#1440](https://github.com/eyaltoledano/claude-task-master/pull/1440) [`9f6f3af`](https://github.com/eyaltoledano/claude-task-master/commit/9f6f3affe322512a8708624850c144b4b890e782) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Correct swe scores of haiku 4.5 and sonnet 4.5

- [#1436](https://github.com/eyaltoledano/claude-task-master/pull/1436) [`c1df63d`](https://github.com/eyaltoledano/claude-task-master/commit/c1df63d7229f05b57abba4af11e74a8d2bc6dcd9) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Upgrade ai-sdk-provider-claude-code to v2.2.0 for native structured outputs support.

## 0.34.0

### Minor Changes

- [#1425](https://github.com/eyaltoledano/claude-task-master/pull/1425) [`99d9179`](https://github.com/eyaltoledano/claude-task-master/commit/99d9179522dc66797ec7e3f428d72b46a9557f09) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Deprecated generate command

## 0.33.0

### Minor Changes

- [#1427](https://github.com/eyaltoledano/claude-task-master/pull/1427) [`122c23a`](https://github.com/eyaltoledano/claude-task-master/commit/122c23abb36634c1e68c476d681f41b4b4991671) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Added Gemini 3 pro preview to supported Taskmaster AI providers
  - Added to Google providers
  - Added to Gemini CLI providers
    - Attention: Gemini 3 Pro is available for:
      - Google AI Ultra Subscribers
      - Users who have access via a paid Gemini API key
        - If you want to use the gemini api key, make sure you have this defined in your .env or mcp.json env variables: `GEMINI_API_KEY=xxxx`

## 0.32.2

### Patch Changes

- [#1421](https://github.com/eyaltoledano/claude-task-master/pull/1421) [`e75946b`](https://github.com/eyaltoledano/claude-task-master/commit/e75946b1a998269e6a751d2b5baf5c3b7e9b9f46) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Upgrade fastmcp dependency to solve `Server does not support completions (required for completion/complete)`
  - This resolves errors where MCP clients (like Cursor) failed to connect to the Task Master MCP server:
    - [#1413](https://github.com/eyaltoledano/claude-task-master/issues/1413)
    - [#1411](https://github.com/eyaltoledano/claude-task-master/issues/1411)

## 0.32.1

### Patch Changes

- [#1396](https://github.com/eyaltoledano/claude-task-master/pull/1396) [`9883e83`](https://github.com/eyaltoledano/claude-task-master/commit/9883e83b78306e55003e960ea072a11048d89ec9) Thanks [@bjcoombs](https://github.com/bjcoombs)! - Fix box title alignment by adding emoji variant selector to warning sign

## 0.32.0

### Minor Changes

- [#1382](https://github.com/eyaltoledano/claude-task-master/pull/1382) [`ac4328a`](https://github.com/eyaltoledano/claude-task-master/commit/ac4328ae86380c50bb84fff0e98e2370f4ea666f) Thanks [@JJVvV](https://github.com/JJVvV)! - Added opt-in proxy support for all AI providers - respects http_proxy/https_proxy environment variables when enabled.

  When using Task Master in corporate or restricted network environments that require HTTP/HTTPS proxies, API calls to AI providers (OpenAI, Anthropic, Google, AWS Bedrock, etc.) would previously fail with ECONNRESET errors. This update adds seamless proxy support that can be enabled via environment variable or configuration file.

  **How to enable:**

  Proxy support is opt-in. Enable it using either method:

  **Method 1: Environment Variable**

  ```bash
  export TASKMASTER_ENABLE_PROXY=true
  export http_proxy=http://your-proxy:port
  export https_proxy=http://your-proxy:port
  export no_proxy=localhost,127.0.0.1  # Optional: bypass proxy for specific hosts

  # Then use Task Master normally
  task-master add-task "Create a new feature"
  ```

  **Method 2: Configuration File**

  Add to `.taskmaster/config.json`:

  ```json
  {
    "global": {
      "enableProxy": true
    }
  }
  ```

  Then set your proxy environment variables:

  ```bash
  export http_proxy=http://your-proxy:port
  export https_proxy=http://your-proxy:port
  ```

  **Technical details:**
  - Uses undici's `EnvHttpProxyAgent` for automatic proxy detection
  - Centralized implementation in `BaseAIProvider` for consistency across all providers
  - Supports all AI providers: OpenAI, Anthropic, Perplexity, Azure OpenAI, Google AI, Google Vertex AI, AWS Bedrock, and OpenAI-compatible providers
  - Opt-in design ensures users without proxy requirements are not affected
  - Priority: `TASKMASTER_ENABLE_PROXY` environment variable > `config.json` setting

- [#1408](https://github.com/eyaltoledano/claude-task-master/pull/1408) [`10ec025`](https://github.com/eyaltoledano/claude-task-master/commit/10ec0255812dad00aaa72f1b31f41ca978e4451c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add --json back to `task-master list` and `task-master show` for when using the commands with ai agents (less context)

- [#1398](https://github.com/eyaltoledano/claude-task-master/pull/1398) [`e59c16c`](https://github.com/eyaltoledano/claude-task-master/commit/e59c16c707d3ade479a422d8c617004eac1a857f) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Claude Code provider now respects your global, project, and local Claude Code configuration files.

  When using the Claude Code AI provider, Task Master now automatically loads your Claude Code settings from:
  - **Global config** (`~/.claude/` directory) - Your personal preferences across all projects
  - **Project config** (`.claude/` directory) - Project-specific settings like CLAUDE.md instructions
  - **Local config** - Workspace-specific overrides

  This means your CLAUDE.md files, custom instructions, and Claude Code settings will now be properly applied when Task Master uses Claude Code as an AI provider. Previously, these settings were being ignored.

  **What's improved:**
  - ✅ CLAUDE.md files are now automatically loaded and applied (global and local)
  - ✅ Your custom Claude Code settings are respected
  - ✅ Project-specific instructions work as expected
  - ✅ No manual configuration needed - works out of the box

  **Issues:**
  - Resolves #1391
  - Resolves #1315

### Patch Changes

- [#1400](https://github.com/eyaltoledano/claude-task-master/pull/1400) [`c62cf84`](https://github.com/eyaltoledano/claude-task-master/commit/c62cf845dad1960ec183df217293d4edbeea71b9) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix subtasks not showing parent task when displaying in cli (eg. tm show 10)

- [#1393](https://github.com/eyaltoledano/claude-task-master/pull/1393) [`da8ed6a`](https://github.com/eyaltoledano/claude-task-master/commit/da8ed6aa116b9ade3ef4502dd8b8c44727057b5f) Thanks [@bjcoombs](https://github.com/bjcoombs)! - Fix completion percentage and dependency resolution to treat cancelled tasks as complete. Cancelled tasks now correctly count toward project completion (e.g., 14 done + 1 cancelled = 100%, not 93%) and satisfy dependencies for dependent tasks, preventing permanent blocks.

- [#1407](https://github.com/eyaltoledano/claude-task-master/pull/1407) [`0003b6f`](https://github.com/eyaltoledano/claude-task-master/commit/0003b6fca6b8c9320ee959fb0081eed4ba086b98) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix complexity analysis prompt to ensure consistent JSON output format

- [#1351](https://github.com/eyaltoledano/claude-task-master/pull/1351) [`37aee78`](https://github.com/eyaltoledano/claude-task-master/commit/37aee7809ce753104692b2024eb8b2bb0d376c14) Thanks [@bjcoombs](https://github.com/bjcoombs)! - fix: prioritize .taskmaster in parent directories over other project markers

  When running task-master commands from subdirectories containing other project markers (like .git, go.mod, package.json), findProjectRoot() now correctly finds and uses .taskmaster directories in parent folders instead of stopping at the first generic project marker found.

  This enables multi-repo monorepo setups where a single .taskmaster at the root tracks work across multiple sub-repositories.

- [#1406](https://github.com/eyaltoledano/claude-task-master/pull/1406) [`9079d04`](https://github.com/eyaltoledano/claude-task-master/commit/9079d0417907f468360e8db8dd461abb619609e7) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP server compatibility with Cursor IDE's latest update by upgrading to fastmcp v3.20.1 with Zod v4 support
  - This resolves connection failures where the MCP server was unable to establish proper capability negotiation.
  - Issue typically included wording like: `Server does not support completions`

## 0.32.0-rc.0

### Minor Changes

- [#1398](https://github.com/eyaltoledano/claude-task-master/pull/1398) [`e59c16c`](https://github.com/eyaltoledano/claude-task-master/commit/e59c16c707d3ade479a422d8c617004eac1a857f) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Claude Code provider now respects your global, project, and local Claude Code configuration files.

  When using the Claude Code AI provider, Task Master now automatically loads your Claude Code settings from:
  - **Global config** (`~/.claude/` directory) - Your personal preferences across all projects
  - **Project config** (`.claude/` directory) - Project-specific settings like CLAUDE.md instructions
  - **Local config** - Workspace-specific overrides

  This means your CLAUDE.md files, custom instructions, and Claude Code settings will now be properly applied when Task Master uses Claude Code as an AI provider. Previously, these settings were being ignored.

  **What's improved:**
  - ✅ CLAUDE.md files are now automatically loaded and applied (global and local)
  - ✅ Your custom Claude Code settings are respected
  - ✅ Project-specific instructions work as expected
  - ✅ No manual configuration needed - works out of the box

  **Issues:**
  - Resolves #1391
  - Resolves #1315

### Patch Changes

- [#1400](https://github.com/eyaltoledano/claude-task-master/pull/1400) [`c62cf84`](https://github.com/eyaltoledano/claude-task-master/commit/c62cf845dad1960ec183df217293d4edbeea71b9) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix subtasks not showing parent task when displaying in cli (eg. tm show 10)

- [#1393](https://github.com/eyaltoledano/claude-task-master/pull/1393) [`da8ed6a`](https://github.com/eyaltoledano/claude-task-master/commit/da8ed6aa116b9ade3ef4502dd8b8c44727057b5f) Thanks [@bjcoombs](https://github.com/bjcoombs)! - Fix completion percentage and dependency resolution to treat cancelled tasks as complete. Cancelled tasks now correctly count toward project completion (e.g., 14 done + 1 cancelled = 100%, not 93%) and satisfy dependencies for dependent tasks, preventing permanent blocks.

- [#1407](https://github.com/eyaltoledano/claude-task-master/pull/1407) [`0003b6f`](https://github.com/eyaltoledano/claude-task-master/commit/0003b6fca6b8c9320ee959fb0081eed4ba086b98) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix complexity analysis prompt to ensure consistent JSON output format

- [#1351](https://github.com/eyaltoledano/claude-task-master/pull/1351) [`37aee78`](https://github.com/eyaltoledano/claude-task-master/commit/37aee7809ce753104692b2024eb8b2bb0d376c14) Thanks [@bjcoombs](https://github.com/bjcoombs)! - fix: prioritize .taskmaster in parent directories over other project markers

  When running task-master commands from subdirectories containing other project markers (like .git, go.mod, package.json), findProjectRoot() now correctly finds and uses .taskmaster directories in parent folders instead of stopping at the first generic project marker found.

  This enables multi-repo monorepo setups where a single .taskmaster at the root tracks work across multiple sub-repositories.

- [#1406](https://github.com/eyaltoledano/claude-task-master/pull/1406) [`9079d04`](https://github.com/eyaltoledano/claude-task-master/commit/9079d0417907f468360e8db8dd461abb619609e7) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP server compatibility with Cursor IDE's latest update by upgrading to fastmcp v3.20.1 with Zod v4 support
  - This resolves connection failures where the MCP server was unable to establish proper capability negotiation.
  - Issue typically included wording like: `Server does not support completions`

- [#1382](https://github.com/eyaltoledano/claude-task-master/pull/1382) [`ac4328a`](https://github.com/eyaltoledano/claude-task-master/commit/ac4328ae86380c50bb84fff0e98e2370f4ea666f) Thanks [@JJVvV](https://github.com/JJVvV)! - Added opt-in proxy support for all AI providers - respects http_proxy/https_proxy environment variables when enabled.

  When using Task Master in corporate or restricted network environments that require HTTP/HTTPS proxies, API calls to AI providers (OpenAI, Anthropic, Google, AWS Bedrock, etc.) would previously fail with ECONNRESET errors. This update adds seamless proxy support that can be enabled via environment variable or configuration file.

  **How to enable:**

  Proxy support is opt-in. Enable it using either method:

  **Method 1: Environment Variable**

  ```bash
  export TASKMASTER_ENABLE_PROXY=true
  export http_proxy=http://your-proxy:port
  export https_proxy=http://your-proxy:port
  export no_proxy=localhost,127.0.0.1  # Optional: bypass proxy for specific hosts

  # Then use Task Master normally
  task-master add-task "Create a new feature"
  ```

  **Method 2: Configuration File**

  Add to `.taskmaster/config.json`:

  ```json
  {
    "global": {
      "enableProxy": true
    }
  }
  ```

  Then set your proxy environment variables:

  ```bash
  export http_proxy=http://your-proxy:port
  export https_proxy=http://your-proxy:port
  ```

  **Technical details:**
  - Uses undici's `EnvHttpProxyAgent` for automatic proxy detection
  - Centralized implementation in `BaseAIProvider` for consistency across all providers
  - Supports all AI providers: OpenAI, Anthropic, Perplexity, Azure OpenAI, Google AI, Google Vertex AI, AWS Bedrock, and OpenAI-compatible providers
  - Opt-in design ensures users without proxy requirements are not affected
  - Priority: `TASKMASTER_ENABLE_PROXY` environment variable > `config.json` setting

- [#1408](https://github.com/eyaltoledano/claude-task-master/pull/1408) [`10ec025`](https://github.com/eyaltoledano/claude-task-master/commit/10ec0255812dad00aaa72f1b31f41ca978e4451c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add --json back to `task-master list` and `task-master show` for when using the commands with ai agents (less context)

## 0.31.2

### Patch Changes

- [#1377](https://github.com/eyaltoledano/claude-task-master/pull/1377) [`3c22875`](https://github.com/eyaltoledano/claude-task-master/commit/3c22875efeb5d21754d447a9559817bc5327a234) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix parse-prd schema to accept responses from models that omit optional fields (like Z.ai/GLM). Changed `metadata` field to use union pattern with `.default(null)` for better structured outputs compatibility.

- [#1377](https://github.com/eyaltoledano/claude-task-master/pull/1377) [`3c22875`](https://github.com/eyaltoledano/claude-task-master/commit/3c22875efeb5d21754d447a9559817bc5327a234) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix ai response not showing price after its json was repaired

- [#1377](https://github.com/eyaltoledano/claude-task-master/pull/1377) [`3c22875`](https://github.com/eyaltoledano/claude-task-master/commit/3c22875efeb5d21754d447a9559817bc5327a234) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Enable structured outputs for Z.ai providers. Added `supportsStructuredOutputs: true` to use `json_schema` mode for more reliable JSON generation in operations like parse-prd.

## 0.31.1

### Patch Changes

- [#1370](https://github.com/eyaltoledano/claude-task-master/pull/1370) [`9c3b273`](https://github.com/eyaltoledano/claude-task-master/commit/9c3b2737dd224e788b197f41df644ea0a6f4cfe2) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add support for ZAI (GLM) Coding Plan subscription endpoint as a separate provider. Users can now select between two ZAI providers:
  - **zai**: Standard ZAI endpoint (`https://api.z.ai/api/paas/v4/`)
  - **zai-coding**: Coding Plan endpoint (`https://api.z.ai/api/coding/paas/v4/`)

  Both providers use the same model IDs (glm-4.6, glm-4.5) but route to different API endpoints based on your subscription. When running `tm models --setup`, you'll see both providers listed separately:
  - `zai / glm-4.6` - Standard endpoint
  - `zai-coding / glm-4.6` - Coding Plan endpoint

- [#1371](https://github.com/eyaltoledano/claude-task-master/pull/1371) [`abf46b8`](https://github.com/eyaltoledano/claude-task-master/commit/abf46b8087c2f32466a71d057415bab315e35567) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improved auto-update experience:
  - updates now happen before your CLI command runs and automatically restart to execute your command with the new version.
  - No more manual restarts needed!

## 0.31.0

### Minor Changes

- [#1360](https://github.com/eyaltoledano/claude-task-master/pull/1360) [`819d5e1`](https://github.com/eyaltoledano/claude-task-master/commit/819d5e1bc5fb81be4b25f1823988a8e20abe8440) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add support for custom OpenAI-compatible providers, allowing you to connect Task Master to any service that implements the OpenAI API specification

  **How to use:**

  Configure your custom provider with the `models` command:

  ```bash
  task-master models --set-main <your-model-id> --openai-compatible --baseURL <your-api-endpoint>
  ```

  Example:

  ```bash
  task-master models --set-main llama-3-70b --openai-compatible --baseURL http://localhost:8000/v1
  # Or for an interactive view
  task-master models --setup
  ```

  Set your API key (if required by your provider) in mcp.json, your .env file or in your env exports:

  ```bash
  OPENAI_COMPATIBLE_API_KEY="your-key-here"
  ```

  This gives you the flexibility to use virtually any LLM service with Task Master, whether it's self-hosted, a specialized provider, or a custom inference server.

- [#1360](https://github.com/eyaltoledano/claude-task-master/pull/1360) [`819d5e1`](https://github.com/eyaltoledano/claude-task-master/commit/819d5e1bc5fb81be4b25f1823988a8e20abe8440) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add native support for Z.ai (GLM models), giving you access to high-performance Chinese models including glm-4.6 with massive 200K+ token context windows at competitive pricing

  **How to use:**
  1. Get your Z.ai API key from <https://z.ai/manage-apikey/apikey-list>
  2. Set your API key in .env, mcp.json or in env exports:

     ```bash
     ZAI_API_KEY="your-key-here"
     ```

  3. Configure Task Master to use GLM models:

     ```bash
     task-master models --set-main glm-4.6
     # Or for an interactive view
     task-master models --setup
     ```

  **Available models:**
  - `glm-4.6` - Latest model with 200K+ context, excellent for complex projects
  - `glm-4.5` - Previous generation, still highly capable
  - Additional GLM variants for different use cases: `glm-4.5-air`, `glm-4.5v`

  GLM models offer strong performance on software engineering tasks, with particularly good results on code generation and technical reasoning. The large context window makes them ideal for analyzing entire codebases or working with extensive documentation.

- [#1360](https://github.com/eyaltoledano/claude-task-master/pull/1360) [`819d5e1`](https://github.com/eyaltoledano/claude-task-master/commit/819d5e1bc5fb81be4b25f1823988a8e20abe8440) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add LM Studio integration, enabling you to run Task Master completely offline with local models at zero API cost.

  **How to use:**
  1. Download and install [LM Studio](https://lmstudio.ai/)
  2. Launch LM Studio and download a model (e.g., Llama 3.2, Mistral, Qwen)
  3. Optional: Add api key to mcp.json or .env (LMSTUDIO_API_KEY)
  4. Go to the "Local Server" tab and click "Start Server"
  5. Configure Task Master:

     ```bash
     task-master models --set-main <model-name> --lmstudio
     ```

     Example:

     ```bash
     task-master models --set-main llama-3.2-3b --lmstudio
     ```

### Patch Changes

- [#1362](https://github.com/eyaltoledano/claude-task-master/pull/1362) [`3e70edf`](https://github.com/eyaltoledano/claude-task-master/commit/3e70edfa3a1f47bd8a6d2d2a30c20c72f5758b9b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve parse PRD schema for better llm model compatiblity
  - Fixes #1353

- [#1358](https://github.com/eyaltoledano/claude-task-master/pull/1358) [`0c639bd`](https://github.com/eyaltoledano/claude-task-master/commit/0c639bd1db9d2d9b4c2c22ac60b0d875ba75f80e) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix subtask ID display to show full compound notation

  When displaying a subtask via `tm show 104.1`, the header and properties table showed only the subtask's local ID (e.g., "1") instead of the full compound ID (e.g., "104.1"). The CLI now preserves and displays the original requested task ID throughout the display chain, ensuring subtasks are clearly identified with their parent context. Also improved TypeScript typing by using discriminated unions for Task/Subtask returns from `tasks.get()`, eliminating unsafe type coercions.

- [#1339](https://github.com/eyaltoledano/claude-task-master/pull/1339) [`3b09b5d`](https://github.com/eyaltoledano/claude-task-master/commit/3b09b5da2a929f260d275f056d35bb6ded54ca6d) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fixed MCP server sometimes crashing when getting into the commit step of autopilot
  - autopilot now persists state consistently through the whole flow

- [#1326](https://github.com/eyaltoledano/claude-task-master/pull/1326) [`9d5812b`](https://github.com/eyaltoledano/claude-task-master/commit/9d5812ba6725cfadebb8db8f4aa732cf3cdb3a36) Thanks [@SharifMrCreed](https://github.com/SharifMrCreed)! - Improve gemini cli integration

  When initializing Task Master with the `gemini` profile, you now get properly configured context files tailored specifically for Gemini CLI, including MCP configuration and Gemini-specific features like file references, session management, and headless mode.

## 0.31.0-rc.0

### Minor Changes

- [#1360](https://github.com/eyaltoledano/claude-task-master/pull/1360) [`819d5e1`](https://github.com/eyaltoledano/claude-task-master/commit/819d5e1bc5fb81be4b25f1823988a8e20abe8440) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add support for custom OpenAI-compatible providers, allowing you to connect Task Master to any service that implements the OpenAI API specification

  **How to use:**

  Configure your custom provider with the `models` command:

  ```bash
  task-master models --set-main <your-model-id> --openai-compatible --baseURL <your-api-endpoint>
  ```

  Example:

  ```bash
  task-master models --set-main llama-3-70b --openai-compatible --baseURL http://localhost:8000/v1
  # Or for an interactive view
  task-master models --setup
  ```

  Set your API key (if required by your provider) in mcp.json, your .env file or in your env exports:

  ```bash
  OPENAI_COMPATIBLE_API_KEY="your-key-here"
  ```

  This gives you the flexibility to use virtually any LLM service with Task Master, whether it's self-hosted, a specialized provider, or a custom inference server.

- [#1360](https://github.com/eyaltoledano/claude-task-master/pull/1360) [`819d5e1`](https://github.com/eyaltoledano/claude-task-master/commit/819d5e1bc5fb81be4b25f1823988a8e20abe8440) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add native support for Z.ai (GLM models), giving you access to high-performance Chinese models including glm-4.6 with massive 200K+ token context windows at competitive pricing

  **How to use:**
  1. Get your Z.ai API key from <https://z.ai/manage-apikey/apikey-list>
  2. Set your API key in .env, mcp.json or in env exports:

     ```bash
     ZAI_API_KEY="your-key-here"
     ```

  3. Configure Task Master to use GLM models:

     ```bash
     task-master models --set-main glm-4.6
     # Or for an interactive view
     task-master models --setup
     ```

  **Available models:**
  - `glm-4.6` - Latest model with 200K+ context, excellent for complex projects
  - `glm-4.5` - Previous generation, still highly capable
  - Additional GLM variants for different use cases: `glm-4.5-air`, `glm-4.5v`

  GLM models offer strong performance on software engineering tasks, with particularly good results on code generation and technical reasoning. The large context window makes them ideal for analyzing entire codebases or working with extensive documentation.

- [#1360](https://github.com/eyaltoledano/claude-task-master/pull/1360) [`819d5e1`](https://github.com/eyaltoledano/claude-task-master/commit/819d5e1bc5fb81be4b25f1823988a8e20abe8440) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add LM Studio integration, enabling you to run Task Master completely offline with local models at zero API cost.

  **How to use:**
  1. Download and install [LM Studio](https://lmstudio.ai/)
  2. Launch LM Studio and download a model (e.g., Llama 3.2, Mistral, Qwen)
  3. Optional: Add api key to mcp.json or .env (LMSTUDIO_API_KEY)
  4. Go to the "Local Server" tab and click "Start Server"
  5. Configure Task Master:

     ```bash
     task-master models --set-main <model-name> --lmstudio
     ```

     Example:

     ```bash
     task-master models --set-main llama-3.2-3b --lmstudio
     ```

### Patch Changes

- [#1362](https://github.com/eyaltoledano/claude-task-master/pull/1362) [`3e70edf`](https://github.com/eyaltoledano/claude-task-master/commit/3e70edfa3a1f47bd8a6d2d2a30c20c72f5758b9b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve parse PRD schema for better llm model compatiblity
  - Fixes #1353

- [#1358](https://github.com/eyaltoledano/claude-task-master/pull/1358) [`0c639bd`](https://github.com/eyaltoledano/claude-task-master/commit/0c639bd1db9d2d9b4c2c22ac60b0d875ba75f80e) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix subtask ID display to show full compound notation

  When displaying a subtask via `tm show 104.1`, the header and properties table showed only the subtask's local ID (e.g., "1") instead of the full compound ID (e.g., "104.1"). The CLI now preserves and displays the original requested task ID throughout the display chain, ensuring subtasks are clearly identified with their parent context. Also improved TypeScript typing by using discriminated unions for Task/Subtask returns from `tasks.get()`, eliminating unsafe type coercions.

- [#1339](https://github.com/eyaltoledano/claude-task-master/pull/1339) [`3b09b5d`](https://github.com/eyaltoledano/claude-task-master/commit/3b09b5da2a929f260d275f056d35bb6ded54ca6d) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fixed MCP server sometimes crashing when getting into the commit step of autopilot
  - autopilot now persists state consistently through the whole flow

- [#1326](https://github.com/eyaltoledano/claude-task-master/pull/1326) [`9d5812b`](https://github.com/eyaltoledano/claude-task-master/commit/9d5812ba6725cfadebb8db8f4aa732cf3cdb3a36) Thanks [@SharifMrCreed](https://github.com/SharifMrCreed)! - Improve gemini cli integration

  When initializing Task Master with the `gemini` profile, you now get properly configured context files tailored specifically for Gemini CLI, including MCP configuration and Gemini-specific features like file references, session management, and headless mode.

## 0.30.2

### Patch Changes

- [#1340](https://github.com/eyaltoledano/claude-task-master/pull/1340) [`d63a40c`](https://github.com/eyaltoledano/claude-task-master/commit/d63a40c6ddc1ed2fe418206a19acd3e9dc27fd99) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve session persistence reliability

## 0.30.1

### Patch Changes

- [#1305](https://github.com/eyaltoledano/claude-task-master/pull/1305) [`a98d96e`](https://github.com/eyaltoledano/claude-task-master/commit/a98d96ef0414833b948672f86da4acc11f700ebb) Thanks [@bjcoombs](https://github.com/bjcoombs)! - Fix warning message box width to match dashboard box width for consistent UI alignment

- [#1346](https://github.com/eyaltoledano/claude-task-master/pull/1346) [`25addf9`](https://github.com/eyaltoledano/claude-task-master/commit/25addf919f58b439dbc2f6ccf5be822b48280fa3) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - remove file and complexity report parameter from get-tasks and get-task mcp tool
  - In an effort to reduce complexity and context bloat for ai coding agents, we simplified the parameters of these tools

## 0.30.1-rc.0

### Patch Changes

- [#1305](https://github.com/eyaltoledano/claude-task-master/pull/1305) [`a98d96e`](https://github.com/eyaltoledano/claude-task-master/commit/a98d96ef0414833b948672f86da4acc11f700ebb) Thanks [@bjcoombs](https://github.com/bjcoombs)! - Fix warning message box width to match dashboard box width for consistent UI alignment

## 0.30.0

### Minor Changes

- [#1181](https://github.com/eyaltoledano/claude-task-master/pull/1181) [`a69d8c9`](https://github.com/eyaltoledano/claude-task-master/commit/a69d8c91dc9205a3fdaf9d32276144fa3bcad55d) Thanks [@karol-f](https://github.com/karol-f)! - Add configurable MCP tool loading to optimize LLM context usage

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

- [#1312](https://github.com/eyaltoledano/claude-task-master/pull/1312) [`d7fca18`](https://github.com/eyaltoledano/claude-task-master/commit/d7fca1844f24ad8ce079c21d9799a3c4b4413381) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve next command to work with remote

- [#1317](https://github.com/eyaltoledano/claude-task-master/pull/1317) [`548beb4`](https://github.com/eyaltoledano/claude-task-master/commit/548beb434453c69041572eb5927ee7da7075c213) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add 4.5 haiku and sonnet to supported models for claude-code and anthropic ai providers

- [#1309](https://github.com/eyaltoledano/claude-task-master/pull/1309) [`ccb87a5`](https://github.com/eyaltoledano/claude-task-master/commit/ccb87a516a11f7ec4b03133c8f24f4fd8c3a45fc) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add autonomous TDD workflow automation system with new `tm autopilot` commands and MCP tools for AI-driven test-driven development.

  **New CLI Commands:**
  - `tm autopilot start <taskId>` - Initialize TDD workflow
  - `tm autopilot next` - Get next action in workflow
  - `tm autopilot status` - Check workflow progress
  - `tm autopilot complete` - Advance phase with test results
  - `tm autopilot commit` - Save progress with metadata
  - `tm autopilot resume` - Continue from checkpoint
  - `tm autopilot abort` - Cancel workflow

  **New MCP Tools:**
  Seven new autopilot tools for programmatic control: `autopilot_start`, `autopilot_next`, `autopilot_status`, `autopilot_complete_phase`, `autopilot_commit`, `autopilot_resume`, `autopilot_abort`

  **Features:**
  - Complete RED → GREEN → COMMIT cycle enforcement
  - Intelligent commit message generation with metadata
  - Activity logging and state persistence
  - Configurable workflow settings via `.taskmaster/config.json`
  - Comprehensive AI agent integration documentation

  **Documentation:**
  - AI Agent Integration Guide (2,800+ lines)
  - TDD Quick Start Guide
  - Example prompts and integration patterns

  > **Learn more:** [TDD Workflow Quickstart Guide](https://dev.task-master.dev/tdd-workflow/quickstart)

  This release enables AI agents to autonomously execute test-driven development workflows with full state management and recovery capabilities.

### Patch Changes

- [#1314](https://github.com/eyaltoledano/claude-task-master/pull/1314) [`6bc75c0`](https://github.com/eyaltoledano/claude-task-master/commit/6bc75c0ac68b59cb10cee70574a689f83e4de768) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve auth token refresh flow

- [#1302](https://github.com/eyaltoledano/claude-task-master/pull/1302) [`3283506`](https://github.com/eyaltoledano/claude-task-master/commit/3283506444d59896ecb97721ef2e96e290eb84d3) Thanks [@bjcoombs](https://github.com/bjcoombs)! - Enable Task Master commands to traverse parent directories to find project root from nested paths

  Fixes #1301

- [#1323](https://github.com/eyaltoledano/claude-task-master/pull/1323) [`dc6652c`](https://github.com/eyaltoledano/claude-task-master/commit/dc6652ccd2b50b91eb55d92899ebf70c7b4d6601) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP server compatibility with Draft-07 clients (Augment IDE, gemini-cli, gemini code assist)
  - Resolves #1284

  **Problem:**
  - MCP tools were using Zod v4, which outputs JSON Schema Draft 2020-12
  - MCP clients only support Draft-07
  - Tools were not discoverable in gemini-cli and other clients

  **Solution:**
  - Updated all MCP tools to import from `zod/v3` instead of `zod`
  - Zod v3 schemas convert to Draft-07 via FastMCP's zod-to-json-schema
  - Fixed logger to use stderr instead of stdout (MCP protocol requirement)

  This is a temporary workaround until FastMCP adds JSON Schema version configuration.

## 0.30.0-rc.1

### Minor Changes

- [#1317](https://github.com/eyaltoledano/claude-task-master/pull/1317) [`548beb4`](https://github.com/eyaltoledano/claude-task-master/commit/548beb434453c69041572eb5927ee7da7075c213) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add 4.5 haiku and sonnet to supported models for claude-code and anthropic ai providers

- [#1309](https://github.com/eyaltoledano/claude-task-master/pull/1309) [`ccb87a5`](https://github.com/eyaltoledano/claude-task-master/commit/ccb87a516a11f7ec4b03133c8f24f4fd8c3a45fc) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add autonomous TDD workflow automation system with new `tm autopilot` commands and MCP tools for AI-driven test-driven development.

  **New CLI Commands:**
  - `tm autopilot start <taskId>` - Initialize TDD workflow
  - `tm autopilot next` - Get next action in workflow
  - `tm autopilot status` - Check workflow progress
  - `tm autopilot complete` - Advance phase with test results
  - `tm autopilot commit` - Save progress with metadata
  - `tm autopilot resume` - Continue from checkpoint
  - `tm autopilot abort` - Cancel workflow

  **New MCP Tools:**
  Seven new autopilot tools for programmatic control: `autopilot_start`, `autopilot_next`, `autopilot_status`, `autopilot_complete_phase`, `autopilot_commit`, `autopilot_resume`, `autopilot_abort`

  **Features:**
  - Complete RED → GREEN → COMMIT cycle enforcement
  - Intelligent commit message generation with metadata
  - Activity logging and state persistence
  - Configurable workflow settings via `.taskmaster/config.json`
  - Comprehensive AI agent integration documentation

  **Documentation:**
  - AI Agent Integration Guide (2,800+ lines)
  - TDD Quick Start Guide
  - Example prompts and integration patterns

  > **Learn more:** [TDD Workflow Quickstart Guide](https://dev.task-master.dev/tdd-workflow/quickstart)

  This release enables AI agents to autonomously execute test-driven development workflows with full state management and recovery capabilities.

### Patch Changes

- [#1323](https://github.com/eyaltoledano/claude-task-master/pull/1323) [`dc6652c`](https://github.com/eyaltoledano/claude-task-master/commit/dc6652ccd2b50b91eb55d92899ebf70c7b4d6601) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP server compatibility with Draft-07 clients (Augment IDE, gemini-cli, gemini code assist)
  - Resolves #1284

  **Problem:**
  - MCP tools were using Zod v4, which outputs JSON Schema Draft 2020-12
  - MCP clients only support Draft-07
  - Tools were not discoverable in gemini-cli and other clients

  **Solution:**
  - Updated all MCP tools to import from `zod/v3` instead of `zod`
  - Zod v3 schemas convert to Draft-07 via FastMCP's zod-to-json-schema
  - Fixed logger to use stderr instead of stdout (MCP protocol requirement)

  This is a temporary workaround until FastMCP adds JSON Schema version configuration.

## 0.30.0-rc.0

### Minor Changes

- [#1181](https://github.com/eyaltoledano/claude-task-master/pull/1181) [`a69d8c9`](https://github.com/eyaltoledano/claude-task-master/commit/a69d8c91dc9205a3fdaf9d32276144fa3bcad55d) Thanks [@karol-f](https://github.com/karol-f)! - Add configurable MCP tool loading to optimize LLM context usage

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

- [#1312](https://github.com/eyaltoledano/claude-task-master/pull/1312) [`d7fca18`](https://github.com/eyaltoledano/claude-task-master/commit/d7fca1844f24ad8ce079c21d9799a3c4b4413381) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve next command to work with remote

### Patch Changes

- [#1314](https://github.com/eyaltoledano/claude-task-master/pull/1314) [`6bc75c0`](https://github.com/eyaltoledano/claude-task-master/commit/6bc75c0ac68b59cb10cee70574a689f83e4de768) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve auth token refresh flow

- [#1302](https://github.com/eyaltoledano/claude-task-master/pull/1302) [`3283506`](https://github.com/eyaltoledano/claude-task-master/commit/3283506444d59896ecb97721ef2e96e290eb84d3) Thanks [@bjcoombs](https://github.com/bjcoombs)! - Enable Task Master commands to traverse parent directories to find project root from nested paths

  Fixes #1301

## 0.29.0

### Minor Changes

- [#1286](https://github.com/eyaltoledano/claude-task-master/pull/1286) [`f12a16d`](https://github.com/eyaltoledano/claude-task-master/commit/f12a16d09649f62148515f11f616157c7d0bd2d5) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add changelog highlights to auto-update notifications

  When the CLI auto-updates to a new version, it now displays a "What's New" section.

- [#1293](https://github.com/eyaltoledano/claude-task-master/pull/1293) [`3010b90`](https://github.com/eyaltoledano/claude-task-master/commit/3010b90d98f3a7d8636caa92fc33d6ee69d4bed0) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Claude Code plugin with marketplace distribution

  This release introduces official Claude Code plugin support, marking the evolution from legacy `.claude` directory copying to a modern plugin-based architecture.

  ## 🎉 New: Claude Code Plugin

  Task Master AI commands and agents are now distributed as a proper Claude Code plugin:
  - **49 slash commands** with clean naming (`/taskmaster:command-name`)
  - **3 specialized AI agents** (task-orchestrator, task-executor, task-checker)
  - **MCP server integration** for deep Claude Code integration

  **Installation:**

  ```bash
  /plugin marketplace add eyaltoledano/claude-task-master
  /plugin install taskmaster@taskmaster
  ```

  ### The `rules add claude` command no longer copies commands and agents to `.claude/commands/` and `.claude/agents/`. Instead, it now
  - Shows plugin installation instructions
  - Only manages CLAUDE.md imports for agent instructions
  - Directs users to install the official plugin

  **Migration for Existing Users:**

  If you previously used `rules add claude`:
  1. The old commands in `.claude/commands/` will continue to work but won't receive updates
  2. Install the plugin for the latest features: `/plugin install taskmaster@taskmaster`
  3. remove old `.claude/commands/` and `.claude/agents/` directories

  **Why This Change?**

  Claude Code plugins provide:
  - ✅ Automatic updates when we release new features
  - ✅ Better command organization and naming
  - ✅ Seamless integration with Claude Code
  - ✅ No manual file copying or management

  The plugin system is the future of Task Master AI integration with Claude Code!

- [#1285](https://github.com/eyaltoledano/claude-task-master/pull/1285) [`2a910a4`](https://github.com/eyaltoledano/claude-task-master/commit/2a910a40bac375f9f61d797bf55597303d556b48) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add RPG (Repository Planning Graph) method template for structured PRD creation. The new `example_prd_rpg.txt` template teaches AI agents and developers the RPG methodology through embedded instructions, inline good/bad examples, and XML-style tags for structure. This template enables creation of dependency-aware PRDs that automatically generate topologically-ordered task graphs when parsed with Task Master.

  Key features:
  - Method-as-template: teaches RPG principles (dual-semantics, explicit dependencies, topological order) while being used
  - Inline instructions at decision points guide AI through each section
  - Good/bad examples for immediate pattern matching
  - Flexible plain-text format with XML-style tags for parseability
  - Critical dependency-graph section ensures correct task ordering
  - Automatic inclusion during `task-master init`
  - Comprehensive documentation at [docs.task-master.dev/capabilities/rpg-method](https://docs.task-master.dev/capabilities/rpg-method)
  - Tool recommendations for code-context-aware PRD creation (Claude Code, Cursor, Gemini CLI, Codex/Grok)

  The RPG template complements the existing `example_prd.txt` and provides a more structured approach for complex projects requiring clear module boundaries and dependency chains.

- [#1287](https://github.com/eyaltoledano/claude-task-master/pull/1287) [`90e6bdc`](https://github.com/eyaltoledano/claude-task-master/commit/90e6bdcf1c59f65ad27fcdfe3b13b9dca7e77654) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Enhance `expand_all` to intelligently use complexity analysis recommendations when expanding tasks.

  The expand-all operation now automatically leverages recommendations from `analyze-complexity` to determine optimal subtask counts for each task, resulting in more accurate and context-aware task breakdowns.

  Key improvements:
  - Automatic integration with complexity analysis reports
  - Tag-aware complexity report path resolution
  - Intelligent subtask count determination based on task complexity
  - Falls back to defaults when complexity analysis is unavailable
  - Enhanced logging for better visibility into expansion decisions

  When you run `task-master expand --all` after `task-master analyze-complexity`, Task Master now uses the recommended subtask counts from the complexity analysis instead of applying uniform defaults, ensuring each task is broken down according to its actual complexity.

### Patch Changes

- [#1191](https://github.com/eyaltoledano/claude-task-master/pull/1191) [`aaf903f`](https://github.com/eyaltoledano/claude-task-master/commit/aaf903ff2f606c779a22e9a4b240ab57b3683815) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix cross-level task dependencies not being saved

  Fixes an issue where adding dependencies between subtasks and top-level tasks (e.g., `task-master add-dependency --id=2.2 --depends-on=11`) would report success but fail to persist the changes. Dependencies can now be created in both directions between any task levels.

- [#1299](https://github.com/eyaltoledano/claude-task-master/pull/1299) [`4c1ef2c`](https://github.com/eyaltoledano/claude-task-master/commit/4c1ef2ca94411c53bcd2a78ec710b06c500236dd) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve refresh token when authenticating

## 0.29.0-rc.1

### Patch Changes

- [#1299](https://github.com/eyaltoledano/claude-task-master/pull/1299) [`a6c5152`](https://github.com/eyaltoledano/claude-task-master/commit/a6c5152f20edd8717cf1aea34e7c178b1261aa99) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve refresh token when authenticating

## 0.29.0-rc.0

### Minor Changes

- [#1286](https://github.com/eyaltoledano/claude-task-master/pull/1286) [`f12a16d`](https://github.com/eyaltoledano/claude-task-master/commit/f12a16d09649f62148515f11f616157c7d0bd2d5) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add changelog highlights to auto-update notifications

  When the CLI auto-updates to a new version, it now displays a "What's New" section.

- [#1293](https://github.com/eyaltoledano/claude-task-master/pull/1293) [`3010b90`](https://github.com/eyaltoledano/claude-task-master/commit/3010b90d98f3a7d8636caa92fc33d6ee69d4bed0) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Claude Code plugin with marketplace distribution

  This release introduces official Claude Code plugin support, marking the evolution from legacy `.claude` directory copying to a modern plugin-based architecture.

  ## 🎉 New: Claude Code Plugin

  Task Master AI commands and agents are now distributed as a proper Claude Code plugin:
  - **49 slash commands** with clean naming (`/task-master-ai:command-name`)
  - **3 specialized AI agents** (task-orchestrator, task-executor, task-checker)
  - **MCP server integration** for deep Claude Code integration

  **Installation:**

  ```bash
  /plugin marketplace add eyaltoledano/claude-task-master
  /plugin install taskmaster@taskmaster
  ```

  ### The `rules add claude` command no longer copies commands and agents to `.claude/commands/` and `.claude/agents/`. Instead, it now
  - Shows plugin installation instructions
  - Only manages CLAUDE.md imports for agent instructions
  - Directs users to install the official plugin

  **Migration for Existing Users:**

  If you previously used `rules add claude`:
  1. The old commands in `.claude/commands/` will continue to work but won't receive updates
  2. Install the plugin for the latest features: `/plugin install taskmaster@taskmaster`
  3. remove old `.claude/commands/` and `.claude/agents/` directories

  **Why This Change?**

  Claude Code plugins provide:
  - ✅ Automatic updates when we release new features
  - ✅ Better command organization and naming
  - ✅ Seamless integration with Claude Code
  - ✅ No manual file copying or management

  The plugin system is the future of Task Master AI integration with Claude Code!

- [#1285](https://github.com/eyaltoledano/claude-task-master/pull/1285) [`2a910a4`](https://github.com/eyaltoledano/claude-task-master/commit/2a910a40bac375f9f61d797bf55597303d556b48) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add RPG (Repository Planning Graph) method template for structured PRD creation. The new `example_prd_rpg.txt` template teaches AI agents and developers the RPG methodology through embedded instructions, inline good/bad examples, and XML-style tags for structure. This template enables creation of dependency-aware PRDs that automatically generate topologically-ordered task graphs when parsed with Task Master.

  Key features:
  - Method-as-template: teaches RPG principles (dual-semantics, explicit dependencies, topological order) while being used
  - Inline instructions at decision points guide AI through each section
  - Good/bad examples for immediate pattern matching
  - Flexible plain-text format with XML-style tags for parseability
  - Critical dependency-graph section ensures correct task ordering
  - Automatic inclusion during `task-master init`
  - Comprehensive documentation at [docs.task-master.dev/capabilities/rpg-method](https://docs.task-master.dev/capabilities/rpg-method)
  - Tool recommendations for code-context-aware PRD creation (Claude Code, Cursor, Gemini CLI, Codex/Grok)

  The RPG template complements the existing `example_prd.txt` and provides a more structured approach for complex projects requiring clear module boundaries and dependency chains.

- [#1287](https://github.com/eyaltoledano/claude-task-master/pull/1287) [`90e6bdc`](https://github.com/eyaltoledano/claude-task-master/commit/90e6bdcf1c59f65ad27fcdfe3b13b9dca7e77654) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Enhance `expand_all` to intelligently use complexity analysis recommendations when expanding tasks.

  The expand-all operation now automatically leverages recommendations from `analyze-complexity` to determine optimal subtask counts for each task, resulting in more accurate and context-aware task breakdowns.

  Key improvements:
  - Automatic integration with complexity analysis reports
  - Tag-aware complexity report path resolution
  - Intelligent subtask count determination based on task complexity
  - Falls back to defaults when complexity analysis is unavailable
  - Enhanced logging for better visibility into expansion decisions

  When you run `task-master expand --all` after `task-master analyze-complexity`, Task Master now uses the recommended subtask counts from the complexity analysis instead of applying uniform defaults, ensuring each task is broken down according to its actual complexity.

### Patch Changes

- [#1191](https://github.com/eyaltoledano/claude-task-master/pull/1191) [`aaf903f`](https://github.com/eyaltoledano/claude-task-master/commit/aaf903ff2f606c779a22e9a4b240ab57b3683815) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix cross-level task dependencies not being saved

  Fixes an issue where adding dependencies between subtasks and top-level tasks (e.g., `task-master add-dependency --id=2.2 --depends-on=11`) would report success but fail to persist the changes. Dependencies can now be created in both directions between any task levels.

## 0.28.0

### Minor Changes

- [#1273](https://github.com/eyaltoledano/claude-task-master/pull/1273) [`b43b7ce`](https://github.com/eyaltoledano/claude-task-master/commit/b43b7ce201625eee956fb2f8cd332f238bb78c21) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Add Codex CLI provider with OAuth authentication
  - Added codex-cli provider for GPT-5 and GPT-5-Codex models (272K input / 128K output)
  - OAuth-first authentication via `codex login` - no API key required
  - Optional OPENAI_CODEX_API_KEY support
  - Codebase analysis capabilities automatically enabled
  - Command-specific settings and approval/sandbox modes

- [#1215](https://github.com/eyaltoledano/claude-task-master/pull/1215) [`0079b7d`](https://github.com/eyaltoledano/claude-task-master/commit/0079b7defdad550811f704c470fdd01955d91d4d) Thanks [@joedanz](https://github.com/joedanz)! - Add Cursor IDE custom slash command support

  Expose Task Master commands as Cursor slash commands by copying assets/claude/commands to .cursor/commands on profile add and cleaning up on remove.

- [#1246](https://github.com/eyaltoledano/claude-task-master/pull/1246) [`18aa416`](https://github.com/eyaltoledano/claude-task-master/commit/18aa416035f44345bde1c7321490345733a5d042) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Added api keys page on docs website: docs.task-master.dev/getting-started/api-keys

- [#1246](https://github.com/eyaltoledano/claude-task-master/pull/1246) [`18aa416`](https://github.com/eyaltoledano/claude-task-master/commit/18aa416035f44345bde1c7321490345733a5d042) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Move to AI SDK v5:
  - Works better with claude-code and gemini-cli as ai providers
  - Improved openai model family compatibility
  - Migrate ollama provider to v2
  - Closes #1223, #1013, #1161, #1174

- [#1262](https://github.com/eyaltoledano/claude-task-master/pull/1262) [`738ec51`](https://github.com/eyaltoledano/claude-task-master/commit/738ec51c049a295a12839b2dfddaf05e23b8fede) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Migrate AI services to use generateObject for structured data generation

  This update migrates all AI service calls from generateText to generateObject, ensuring more reliable and structured responses across all commands.

  ### Key Changes:
  - **Unified AI Service**: Replaced separate generateText implementations with a single generateObjectService that handles structured data generation
  - **JSON Mode Support**: Added proper JSON mode configuration for providers that support it (OpenAI, Anthropic, Google, Groq)
  - **Schema Validation**: Integrated Zod schemas for all AI-generated content with automatic validation
  - **Provider Compatibility**: Maintained compatibility with all existing providers while leveraging their native structured output capabilities
  - **Improved Reliability**: Structured output generation reduces parsing errors and ensures consistent data formats

  ### Technical Improvements:
  - Centralized provider configuration in `ai-providers-unified.js`
  - Added `generateObject` support detection for each provider
  - Implemented proper error handling for schema validation failures
  - Maintained backward compatibility with existing prompt structures

  ### Bug Fixes:
  - Fixed subtask ID numbering issue where AI was generating inconsistent IDs (101-105, 601-603) instead of sequential numbering (1, 2, 3...)
  - Enhanced prompt instructions to enforce proper ID generation patterns
  - Ensured subtasks display correctly as X.1, X.2, X.3 format

  This migration improves the reliability and consistency of AI-generated content throughout the Task Master application.

- [#1112](https://github.com/eyaltoledano/claude-task-master/pull/1112) [`d67b81d`](https://github.com/eyaltoledano/claude-task-master/commit/d67b81d25ddd927fabb6f5deb368e8993519c541) Thanks [@olssonsten](https://github.com/olssonsten)! - Enhanced Roo Code profile with MCP timeout configuration for improved reliability during long-running AI operations. The Roo profile now automatically configures a 300-second timeout for MCP server operations, preventing timeouts during complex tasks like `parse-prd`, `expand-all`, `analyze-complexity`, and `research` operations. This change also replaces static MCP configuration files with programmatic generation for better maintainability.

  **What's New:**
  - 300-second timeout for MCP operations (up from default 60 seconds)
  - Programmatic MCP configuration generation (replaces static asset files)
  - Enhanced reliability for AI-powered operations
  - Consistent with other AI coding assistant profiles

  **Migration:** No user action required - existing Roo Code installations will automatically receive the enhanced MCP configuration on next initialization.

- [#1246](https://github.com/eyaltoledano/claude-task-master/pull/1246) [`986ac11`](https://github.com/eyaltoledano/claude-task-master/commit/986ac117aee00bcd3e6830a0f76e1ad6d10e0bca) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Upgrade grok-cli ai provider to ai sdk v5

### Patch Changes

- [#1235](https://github.com/eyaltoledano/claude-task-master/pull/1235) [`aaacc3d`](https://github.com/eyaltoledano/claude-task-master/commit/aaacc3dae36247b4de72b2d2697f49e5df6d01e3) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve `analyze-complexity` cli docs and `--research` flag documentation

- [#1251](https://github.com/eyaltoledano/claude-task-master/pull/1251) [`0b2c696`](https://github.com/eyaltoledano/claude-task-master/commit/0b2c6967c4605c33a100cff16f6ce8ff09ad06f0) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Change parent task back to "pending" when all subtasks are in "pending" state

- [#1274](https://github.com/eyaltoledano/claude-task-master/pull/1274) [`4f984f8`](https://github.com/eyaltoledano/claude-task-master/commit/4f984f8a6965da9f9c7edd60ddfd6560ac022917) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Do a quick fix on build

- [#1277](https://github.com/eyaltoledano/claude-task-master/pull/1277) [`7b5a7c4`](https://github.com/eyaltoledano/claude-task-master/commit/7b5a7c4495a68b782f7407fc5d0e0d3ae81f42f5) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP connection errors caused by deprecated generateTaskFiles calls. Resolves "Cannot read properties of null (reading 'toString')" errors when using MCP tools for task management operations.

- [#1276](https://github.com/eyaltoledano/claude-task-master/pull/1276) [`caee040`](https://github.com/eyaltoledano/claude-task-master/commit/caee040907f856d31a660171c9e6d966f23c632e) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP server error when file parameter not provided - now properly constructs default tasks.json path instead of failing with 'tasksJsonPath is required' error.

- [#1172](https://github.com/eyaltoledano/claude-task-master/pull/1172) [`b5fe723`](https://github.com/eyaltoledano/claude-task-master/commit/b5fe723f8ead928e9f2dbde13b833ee70ac3382d) Thanks [@jujax](https://github.com/jujax)! - Fix Claude Code settings validation for pathToClaudeCodeExecutable

- [#1192](https://github.com/eyaltoledano/claude-task-master/pull/1192) [`2b69936`](https://github.com/eyaltoledano/claude-task-master/commit/2b69936ee7b34346d6de5175af20e077359e2e2a) Thanks [@nukunga](https://github.com/nukunga)! - Fix sonar deep research model failing, should be called `sonar-deep-research`

- [#1270](https://github.com/eyaltoledano/claude-task-master/pull/1270) [`20004a3`](https://github.com/eyaltoledano/claude-task-master/commit/20004a39ea848f747e1ff48981bfe176554e4055) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix complexity score not showing for `task-master show` and `task-master list`
  - Added complexity score on "next task" when running `task-master list`
  - Added colors to complexity to reflect complexity (easy, medium, hard)

## 0.28.0-rc.2

### Minor Changes

- [#1273](https://github.com/eyaltoledano/claude-task-master/pull/1273) [`b43b7ce`](https://github.com/eyaltoledano/claude-task-master/commit/b43b7ce201625eee956fb2f8cd332f238bb78c21) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Add Codex CLI provider with OAuth authentication
  - Added codex-cli provider for GPT-5 and GPT-5-Codex models (272K input / 128K output)
  - OAuth-first authentication via `codex login` - no API key required
  - Optional OPENAI_CODEX_API_KEY support
  - Codebase analysis capabilities automatically enabled
  - Command-specific settings and approval/sandbox modes

### Patch Changes

- [#1277](https://github.com/eyaltoledano/claude-task-master/pull/1277) [`7b5a7c4`](https://github.com/eyaltoledano/claude-task-master/commit/7b5a7c4495a68b782f7407fc5d0e0d3ae81f42f5) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP connection errors caused by deprecated generateTaskFiles calls. Resolves "Cannot read properties of null (reading 'toString')" errors when using MCP tools for task management operations.

- [#1276](https://github.com/eyaltoledano/claude-task-master/pull/1276) [`caee040`](https://github.com/eyaltoledano/claude-task-master/commit/caee040907f856d31a660171c9e6d966f23c632e) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP server error when file parameter not provided - now properly constructs default tasks.json path instead of failing with 'tasksJsonPath is required' error.

## 0.28.0-rc.1

### Patch Changes

- [#1274](https://github.com/eyaltoledano/claude-task-master/pull/1274) [`4f984f8`](https://github.com/eyaltoledano/claude-task-master/commit/4f984f8a6965da9f9c7edd60ddfd6560ac022917) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Do a quick fix on build

## 0.28.0-rc.0

### Minor Changes

- [#1215](https://github.com/eyaltoledano/claude-task-master/pull/1215) [`0079b7d`](https://github.com/eyaltoledano/claude-task-master/commit/0079b7defdad550811f704c470fdd01955d91d4d) Thanks [@joedanz](https://github.com/joedanz)! - Add Cursor IDE custom slash command support

  Expose Task Master commands as Cursor slash commands by copying assets/claude/commands to .cursor/commands on profile add and cleaning up on remove.

- [#1246](https://github.com/eyaltoledano/claude-task-master/pull/1246) [`18aa416`](https://github.com/eyaltoledano/claude-task-master/commit/18aa416035f44345bde1c7321490345733a5d042) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Added api keys page on docs website: docs.task-master.dev/getting-started/api-keys

- [#1246](https://github.com/eyaltoledano/claude-task-master/pull/1246) [`18aa416`](https://github.com/eyaltoledano/claude-task-master/commit/18aa416035f44345bde1c7321490345733a5d042) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Move to AI SDK v5:
  - Works better with claude-code and gemini-cli as ai providers
  - Improved openai model family compatibility
  - Migrate ollama provider to v2
  - Closes #1223, #1013, #1161, #1174

- [#1262](https://github.com/eyaltoledano/claude-task-master/pull/1262) [`738ec51`](https://github.com/eyaltoledano/claude-task-master/commit/738ec51c049a295a12839b2dfddaf05e23b8fede) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Migrate AI services to use generateObject for structured data generation

  This update migrates all AI service calls from generateText to generateObject, ensuring more reliable and structured responses across all commands.

  ### Key Changes:
  - **Unified AI Service**: Replaced separate generateText implementations with a single generateObjectService that handles structured data generation
  - **JSON Mode Support**: Added proper JSON mode configuration for providers that support it (OpenAI, Anthropic, Google, Groq)
  - **Schema Validation**: Integrated Zod schemas for all AI-generated content with automatic validation
  - **Provider Compatibility**: Maintained compatibility with all existing providers while leveraging their native structured output capabilities
  - **Improved Reliability**: Structured output generation reduces parsing errors and ensures consistent data formats

  ### Technical Improvements:
  - Centralized provider configuration in `ai-providers-unified.js`
  - Added `generateObject` support detection for each provider
  - Implemented proper error handling for schema validation failures
  - Maintained backward compatibility with existing prompt structures

  ### Bug Fixes:
  - Fixed subtask ID numbering issue where AI was generating inconsistent IDs (101-105, 601-603) instead of sequential numbering (1, 2, 3...)
  - Enhanced prompt instructions to enforce proper ID generation patterns
  - Ensured subtasks display correctly as X.1, X.2, X.3 format

  This migration improves the reliability and consistency of AI-generated content throughout the Task Master application.

- [#1112](https://github.com/eyaltoledano/claude-task-master/pull/1112) [`d67b81d`](https://github.com/eyaltoledano/claude-task-master/commit/d67b81d25ddd927fabb6f5deb368e8993519c541) Thanks [@olssonsten](https://github.com/olssonsten)! - Enhanced Roo Code profile with MCP timeout configuration for improved reliability during long-running AI operations. The Roo profile now automatically configures a 300-second timeout for MCP server operations, preventing timeouts during complex tasks like `parse-prd`, `expand-all`, `analyze-complexity`, and `research` operations. This change also replaces static MCP configuration files with programmatic generation for better maintainability.

  **What's New:**
  - 300-second timeout for MCP operations (up from default 60 seconds)
  - Programmatic MCP configuration generation (replaces static asset files)
  - Enhanced reliability for AI-powered operations
  - Consistent with other AI coding assistant profiles

  **Migration:** No user action required - existing Roo Code installations will automatically receive the enhanced MCP configuration on next initialization.

- [#1246](https://github.com/eyaltoledano/claude-task-master/pull/1246) [`986ac11`](https://github.com/eyaltoledano/claude-task-master/commit/986ac117aee00bcd3e6830a0f76e1ad6d10e0bca) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Upgrade grok-cli ai provider to ai sdk v5

### Patch Changes

- [#1235](https://github.com/eyaltoledano/claude-task-master/pull/1235) [`aaacc3d`](https://github.com/eyaltoledano/claude-task-master/commit/aaacc3dae36247b4de72b2d2697f49e5df6d01e3) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve `analyze-complexity` cli docs and `--research` flag documentation

- [#1251](https://github.com/eyaltoledano/claude-task-master/pull/1251) [`0b2c696`](https://github.com/eyaltoledano/claude-task-master/commit/0b2c6967c4605c33a100cff16f6ce8ff09ad06f0) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Change parent task back to "pending" when all subtasks are in "pending" state

- [#1172](https://github.com/eyaltoledano/claude-task-master/pull/1172) [`b5fe723`](https://github.com/eyaltoledano/claude-task-master/commit/b5fe723f8ead928e9f2dbde13b833ee70ac3382d) Thanks [@jujax](https://github.com/jujax)! - Fix Claude Code settings validation for pathToClaudeCodeExecutable

- [#1192](https://github.com/eyaltoledano/claude-task-master/pull/1192) [`2b69936`](https://github.com/eyaltoledano/claude-task-master/commit/2b69936ee7b34346d6de5175af20e077359e2e2a) Thanks [@nukunga](https://github.com/nukunga)! - Fix sonar deep research model failing, should be called `sonar-deep-research`

- [#1270](https://github.com/eyaltoledano/claude-task-master/pull/1270) [`20004a3`](https://github.com/eyaltoledano/claude-task-master/commit/20004a39ea848f747e1ff48981bfe176554e4055) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix complexity score not showing for `task-master show` and `task-master list`
  - Added complexity score on "next task" when running `task-master list`
  - Added colors to complexity to reflect complexity (easy, medium, hard)

## 0.27.3

### Patch Changes

- [#1254](https://github.com/eyaltoledano/claude-task-master/pull/1254) [`af53525`](https://github.com/eyaltoledano/claude-task-master/commit/af53525cbc660a595b67d4bb90d906911c71f45d) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fixed issue where `tm show` command could not find subtasks using dotted notation IDs (e.g., '8.1').
  - The command now properly searches within parent task subtasks and returns the correct subtask information.

## 0.27.2

### Patch Changes

- [#1248](https://github.com/eyaltoledano/claude-task-master/pull/1248) [`044a7bf`](https://github.com/eyaltoledano/claude-task-master/commit/044a7bfc98049298177bc655cf341d7a8b6a0011) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix set-status for subtasks:
  - Parent tasks are now set as `done` when subtasks are all `done`
  - Parent tasks are now set as `in-progress` when at least one subtask is `in-progress` or `done`

## 0.27.1

### Patch Changes

- [#1232](https://github.com/eyaltoledano/claude-task-master/pull/1232) [`f487736`](https://github.com/eyaltoledano/claude-task-master/commit/f487736670ef8c484059f676293777eabb249c9e) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix module not found for new 0.27.0 release

- [#1233](https://github.com/eyaltoledano/claude-task-master/pull/1233) [`c911608`](https://github.com/eyaltoledano/claude-task-master/commit/c911608f60454253f4e024b57ca84e5a5a53f65c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix Zed MCP configuration by adding required "source" property
  - Add "source": "custom" property to task-master-ai server in Zed settings.json

## 0.27.1-rc.1

### Patch Changes

- [#1233](https://github.com/eyaltoledano/claude-task-master/pull/1233) [`1a18794`](https://github.com/eyaltoledano/claude-task-master/commit/1a1879483b86c118a4e46c02cbf4acebfcf6bcf9) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - One last testing final final

## 0.27.1-rc.0

### Patch Changes

- [#1232](https://github.com/eyaltoledano/claude-task-master/pull/1232) [`f487736`](https://github.com/eyaltoledano/claude-task-master/commit/f487736670ef8c484059f676293777eabb249c9e) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix module not found for new 0.27.0 release

## 0.27.0

### Minor Changes

- [#1220](https://github.com/eyaltoledano/claude-task-master/pull/1220) [`4e12643`](https://github.com/eyaltoledano/claude-task-master/commit/4e126430a092fb54afb035514fb3d46115714f97) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - No longer need --package=task-master-ai in mcp server
  - A lot of users were having issues with Taskmaster and usually a simple fix was to remove --package from your mcp.json
  - we now bundle our whole package, so we no longer need the --package

- [#1200](https://github.com/eyaltoledano/claude-task-master/pull/1200) [`fce8414`](https://github.com/eyaltoledano/claude-task-master/commit/fce841490a9ebbf1801a42dd8a29397379cf1142) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add new `task-master start` command for automated task execution with Claude Code
  - You can now start working on tasks directly by running `task-master start <task-id>` which will automatically launch Claude Code with a comprehensive prompt containing all task details, implementation guidelines, and context.
  - `task-master start` will automatically detect next-task when no ID is provided.

- [#1200](https://github.com/eyaltoledano/claude-task-master/pull/1200) [`fce8414`](https://github.com/eyaltoledano/claude-task-master/commit/fce841490a9ebbf1801a42dd8a29397379cf1142) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Move from javascript to typescript, not a full refactor but we now have a typescript environment and are moving our javascript commands slowly into typescript

- [#1200](https://github.com/eyaltoledano/claude-task-master/pull/1200) [`fce8414`](https://github.com/eyaltoledano/claude-task-master/commit/fce841490a9ebbf1801a42dd8a29397379cf1142) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add grok-cli as a provider with full codebase context support. You can now use Grok models (grok-2, grok-3, grok-4, etc.) with Task Master for AI operations that have access to your entire codebase context, enabling more informed task generation and PRD parsing.

  ## Setup Instructions
  1. **Get your Grok API key** from [console.x.ai](https://console.x.ai)
  2. **Set the environment variable**:
     ```bash
     export GROK_CLI_API_KEY="your-api-key-here"
     ```
  3. **Configure Task Master to use Grok**:
     ```bash
     task-master models --set-main grok-beta
     # or
     task-master models --set-research grok-beta
     # or
     task-master models --set-fallback grok-beta
     ```

  ## Key Features
  - **Full codebase context**: Grok models can analyze your entire project when generating tasks or parsing PRDs
  - **xAI model access**: Support for latest Grok models (grok-2, grok-3, grok-4, etc.)
  - **Code-aware task generation**: Create more accurate and contextual tasks based on your actual codebase
  - **Intelligent PRD parsing**: Parse requirements with understanding of your existing code structure

  ## Available Models
  - `grok-beta` - Latest Grok model with codebase context
  - `grok-vision-beta` - Grok with vision capabilities and codebase context

  The Grok CLI provider integrates with xAI's Grok models via grok-cli and can also use the local Grok CLI configuration file (`~/.grok/user-settings.json`) if available.

  ## Credits

  Built using the [grok-cli](https://github.com/superagent-ai/grok-cli) by Superagent AI for seamless integration with xAI's Grok models.

- [#1225](https://github.com/eyaltoledano/claude-task-master/pull/1225) [`a621ff0`](https://github.com/eyaltoledano/claude-task-master/commit/a621ff05eafb51a147a9aabd7b37ddc0e45b0869) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve taskmaster ai provider defaults
  - moving from main anthropic 3.7 to anthropic sonnet 4
  - moving from fallback anthropic 3.5 to anthropic 3.7

- [#1217](https://github.com/eyaltoledano/claude-task-master/pull/1217) [`e6de285`](https://github.com/eyaltoledano/claude-task-master/commit/e6de285ceacb0a397e952a63435cd32a9c731515) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - @tm/cli: add auto-update functionality to every command

- [#1200](https://github.com/eyaltoledano/claude-task-master/pull/1200) [`fce8414`](https://github.com/eyaltoledano/claude-task-master/commit/fce841490a9ebbf1801a42dd8a29397379cf1142) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fix Grok model configuration validation and update deprecated Claude fallback model. Grok models now properly support their full 131K token capacity, and the fallback model has been upgraded to Claude Sonnet 4 for better performance and future compatibility.

## 0.27.0-rc.2

### Minor Changes

- [#1217](https://github.com/eyaltoledano/claude-task-master/pull/1217) [`e6de285`](https://github.com/eyaltoledano/claude-task-master/commit/e6de285ceacb0a397e952a63435cd32a9c731515) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - @tm/cli: add auto-update functionality to every command

## 0.27.0-rc.1

### Minor Changes

- [`255b9f0`](https://github.com/eyaltoledano/claude-task-master/commit/255b9f0334555b0063280abde701445cd62fa11b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Testing one more pre-release iteration

## 0.27.0-rc.0

### Minor Changes

- [#1213](https://github.com/eyaltoledano/claude-task-master/pull/1213) [`137ef36`](https://github.com/eyaltoledano/claude-task-master/commit/137ef362789a9cdfdb1925e35e0438c1fa6c69ee) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Test out the RC

### Patch Changes

- Updated dependencies [[`137ef36`](https://github.com/eyaltoledano/claude-task-master/commit/137ef362789a9cdfdb1925e35e0438c1fa6c69ee)]:
  - @tm/cli@0.27.0-rc.0

## 0.26.0

### Minor Changes

- [#1133](https://github.com/eyaltoledano/claude-task-master/pull/1133) [`df26c65`](https://github.com/eyaltoledano/claude-task-master/commit/df26c65632000874a73504963b08f18c46283144) Thanks [@neonwatty](https://github.com/neonwatty)! - Restore Taskmaster claude-code commands and move clear commands under /remove to avoid collision with the claude-code /clear command.

- [#1163](https://github.com/eyaltoledano/claude-task-master/pull/1163) [`37af0f1`](https://github.com/eyaltoledano/claude-task-master/commit/37af0f191227a68d119b7f89a377bf932ee3ac66) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Enhanced Gemini CLI provider with codebase-aware task generation

  Added automatic codebase analysis for Gemini CLI provider in parse-prd, and analyze-complexity, add-task, udpate-task, update, update-subtask commands
  When using Gemini CLI as the AI provider, Task Master now instructs the AI to analyze the project structure, existing implementations, and patterns before generating tasks or subtasks
  Tasks and subtasks generated by Claude Code are now informed by actual codebase analysis, resulting in more accurate and contextual outputs

- [#1165](https://github.com/eyaltoledano/claude-task-master/pull/1165) [`c4f92f6`](https://github.com/eyaltoledano/claude-task-master/commit/c4f92f6a0aee3435c56eb8d27d9aa9204284833e) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add configurable codebase analysis feature flag with multiple configuration sources

  Users can now control whether codebase analysis features (Claude Code and Gemini CLI integration) are enabled through environment variables, MCP configuration, or project config files.

  Priority order: .env > MCP session env > .taskmaster/config.json.

  Set `TASKMASTER_ENABLE_CODEBASE_ANALYSIS=false` in `.env` to disable codebase analysis prompts and tool integration.

- [#1135](https://github.com/eyaltoledano/claude-task-master/pull/1135) [`8783708`](https://github.com/eyaltoledano/claude-task-master/commit/8783708e5e3389890a78fcf685d3da0580e73b3f) Thanks [@mm-parthy](https://github.com/mm-parthy)! - feat(move): improve cross-tag move UX and safety
  - CLI: print "Next Steps" tips after cross-tag moves that used --ignore-dependencies (validate/fix guidance)
  - CLI: show dedicated help block on ID collisions (destination tag already has the ID)
  - Core: add structured suggestions to TASK_ALREADY_EXISTS errors
  - MCP: map ID collision errors to TASK_ALREADY_EXISTS and include suggestions
  - Tests: cover MCP options, error suggestions, CLI tips printing, and integration error payload suggestions

  ***

- [#1162](https://github.com/eyaltoledano/claude-task-master/pull/1162) [`4dad2fd`](https://github.com/eyaltoledano/claude-task-master/commit/4dad2fd613ceac56a65ae9d3c1c03092b8860ac9) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Enhanced Claude Code and Google CLI integration with automatic codebase analysis for task operations

  When using Claude Code as the AI provider, task management commands now automatically analyze your codebase before generating or updating tasks. This provides more accurate, context-aware implementation details that align with your project's existing architecture and patterns.

  Commands contextualised:
  - add-task
  - update-subtask
  - update-task
  - update

### Patch Changes

- [#1135](https://github.com/eyaltoledano/claude-task-master/pull/1135) [`8783708`](https://github.com/eyaltoledano/claude-task-master/commit/8783708e5e3389890a78fcf685d3da0580e73b3f) Thanks [@mm-parthy](https://github.com/mm-parthy)! - docs(move): clarify cross-tag move docs; deprecate "force"; add explicit --with-dependencies/--ignore-dependencies examples

## 0.26.0-rc.1

### Minor Changes

- [#1165](https://github.com/eyaltoledano/claude-task-master/pull/1165) [`c4f92f6`](https://github.com/eyaltoledano/claude-task-master/commit/c4f92f6a0aee3435c56eb8d27d9aa9204284833e) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add configurable codebase analysis feature flag with multiple configuration sources

  Users can now control whether codebase analysis features (Claude Code and Gemini CLI integration) are enabled through environment variables, MCP configuration, or project config files.

  Priority order: .env > MCP session env > .taskmaster/config.json.

  Set `TASKMASTER_ENABLE_CODEBASE_ANALYSIS=false` in `.env` to disable codebase analysis prompts and tool integration.

## 0.26.0-rc.0

### Minor Changes

- [#1163](https://github.com/eyaltoledano/claude-task-master/pull/1163) [`37af0f1`](https://github.com/eyaltoledano/claude-task-master/commit/37af0f191227a68d119b7f89a377bf932ee3ac66) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Enhanced Gemini CLI provider with codebase-aware task generation

  Added automatic codebase analysis for Gemini CLI provider in parse-prd, and analyze-complexity, add-task, udpate-task, update, update-subtask commands
  When using Gemini CLI as the AI provider, Task Master now instructs the AI to analyze the project structure, existing implementations, and patterns before generating tasks or subtasks
  Tasks and subtasks generated by Claude Code are now informed by actual codebase analysis, resulting in more accurate and contextual outputs

- [#1135](https://github.com/eyaltoledano/claude-task-master/pull/1135) [`8783708`](https://github.com/eyaltoledano/claude-task-master/commit/8783708e5e3389890a78fcf685d3da0580e73b3f) Thanks [@mm-parthy](https://github.com/mm-parthy)! - feat(move): improve cross-tag move UX and safety
  - CLI: print "Next Steps" tips after cross-tag moves that used --ignore-dependencies (validate/fix guidance)
  - CLI: show dedicated help block on ID collisions (destination tag already has the ID)
  - Core: add structured suggestions to TASK_ALREADY_EXISTS errors
  - MCP: map ID collision errors to TASK_ALREADY_EXISTS and include suggestions
  - Tests: cover MCP options, error suggestions, CLI tips printing, and integration error payload suggestions

  ***

- [#1162](https://github.com/eyaltoledano/claude-task-master/pull/1162) [`4dad2fd`](https://github.com/eyaltoledano/claude-task-master/commit/4dad2fd613ceac56a65ae9d3c1c03092b8860ac9) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Enhanced Claude Code and Google CLI integration with automatic codebase analysis for task operations

  When using Claude Code as the AI provider, task management commands now automatically analyze your codebase before generating or updating tasks. This provides more accurate, context-aware implementation details that align with your project's existing architecture and patterns.

  Commands contextualised:
  - add-task
  - update-subtask
  - update-task
  - update

### Patch Changes

- [#1135](https://github.com/eyaltoledano/claude-task-master/pull/1135) [`8783708`](https://github.com/eyaltoledano/claude-task-master/commit/8783708e5e3389890a78fcf685d3da0580e73b3f) Thanks [@mm-parthy](https://github.com/mm-parthy)! - docs(move): clarify cross-tag move docs; deprecate "force"; add explicit --with-dependencies/--ignore-dependencies examples

## 0.25.1

### Patch Changes

- [#1152](https://github.com/eyaltoledano/claude-task-master/pull/1152) [`8933557`](https://github.com/eyaltoledano/claude-task-master/commit/89335578ffffc65504b2055c0c85aa7521e5e79b) Thanks [@ben-vargas](https://github.com/ben-vargas)! - fix(claude-code): prevent crash/hang when the optional `@anthropic-ai/claude-code` SDK is missing by guarding `AbortError instanceof` checks and adding explicit SDK presence checks in `doGenerate`/`doStream`. Also bump the optional dependency to `^1.0.88` for improved export consistency.

  Related to JSON truncation handling in #920; this change addresses a separate error-path crash reported in #1142.

- [#1151](https://github.com/eyaltoledano/claude-task-master/pull/1151) [`db720a9`](https://github.com/eyaltoledano/claude-task-master/commit/db720a954d390bb44838cd021b8813dde8f3d8de) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Temporarily disable streaming for improved model compatibility - will be re-enabled in upcoming release

## 0.25.0

### Minor Changes

- [#1088](https://github.com/eyaltoledano/claude-task-master/pull/1088) [`04e11b5`](https://github.com/eyaltoledano/claude-task-master/commit/04e11b5e828597c0ba5b82ca7d5fb6f933e4f1e8) Thanks [@mm-parthy](https://github.com/mm-parthy)! - Add cross-tag task movement functionality for organizing tasks across different contexts.

  This feature enables moving tasks between different tags (contexts) in your project, making it easier to organize work across different branches, environments, or project phases.

  ## CLI Usage Examples

  Move a single task from one tag to another:

  ```bash
  # Move task 5 from backlog tag to in-progress tag
  task-master move --from=5 --from-tag=backlog --to-tag=feature-1

  # Move task with its dependencies
  task-master move --from=5 --from-tag=backlog --to-tag=feature-2 --with-dependencies

  # Move task without checking dependencies
  task-master move --from=5 --from-tag=backlog --to-tag=bug-3 --ignore-dependencies
  ```

  Move multiple tasks at once:

  ```bash
  # Move multiple tasks between tags
  task-master move --from=5,6,7 --from-tag=backlog --to-tag=bug-4 --with-dependencies
  ```

- [#1040](https://github.com/eyaltoledano/claude-task-master/pull/1040) [`fc47714`](https://github.com/eyaltoledano/claude-task-master/commit/fc477143400fd11d953727bf1b4277af5ad308d1) Thanks [@DomVidja](https://github.com/DomVidja)! - "Add Kilo Code profile integration with custom modes and MCP configuration"

- [#1054](https://github.com/eyaltoledano/claude-task-master/pull/1054) [`782728f`](https://github.com/eyaltoledano/claude-task-master/commit/782728ff95aa2e3b766d48273b57f6c6753e8573) Thanks [@martincik](https://github.com/martincik)! - Add compact mode --compact / -c flag to the `tm list` CLI command
  - outputs tasks in a minimal, git-style one-line format. This reduces verbose output from ~30+ lines of dashboards and tables to just 1 line per task, making it much easier to quickly scan available tasks.
    - Git-style format: ID STATUS TITLE (PRIORITY) → DEPS
    - Color-coded status, priority, and dependencies
    - Smart title truncation and dependency abbreviation
    - Subtask support with indentation
    - Full backward compatibility with existing list options

- [#1048](https://github.com/eyaltoledano/claude-task-master/pull/1048) [`e3ed4d7`](https://github.com/eyaltoledano/claude-task-master/commit/e3ed4d7c14b56894d7da675eb2b757423bea8f9d) Thanks [@joedanz](https://github.com/joedanz)! - Add CLI & MCP progress tracking for parse-prd command.

- [#1124](https://github.com/eyaltoledano/claude-task-master/pull/1124) [`95640dc`](https://github.com/eyaltoledano/claude-task-master/commit/95640dcde87ce7879858c0a951399fb49f3b6397) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add support for ollama `gpt-oss:20b` and `gpt-oss:120b`

- [#1123](https://github.com/eyaltoledano/claude-task-master/pull/1123) [`311b243`](https://github.com/eyaltoledano/claude-task-master/commit/311b2433e23c771c8d3a4d3f5ac577302b8321e5) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Remove `clear` Taskmaster claude code commands since they were too close to the claude-code clear command

### Patch Changes

- [#1131](https://github.com/eyaltoledano/claude-task-master/pull/1131) [`3dee60d`](https://github.com/eyaltoledano/claude-task-master/commit/3dee60dc3d566e3cff650accb30f994b8bb3a15e) Thanks [@joedanz](https://github.com/joedanz)! - Update Cursor one-click install link to new URL format

- [#1088](https://github.com/eyaltoledano/claude-task-master/pull/1088) [`04e11b5`](https://github.com/eyaltoledano/claude-task-master/commit/04e11b5e828597c0ba5b82ca7d5fb6f933e4f1e8) Thanks [@mm-parthy](https://github.com/mm-parthy)! - Fix `add-tag --from-branch` command error where `projectRoot` was not properly referenced

  The command was failing with "projectRoot is not defined" error because the code was directly referencing `projectRoot` instead of `context.projectRoot` in the git repository checks. This fix corrects the variable references to use the proper context object.

## 0.25.0-rc.0

### Minor Changes

- [#1088](https://github.com/eyaltoledano/claude-task-master/pull/1088) [`04e11b5`](https://github.com/eyaltoledano/claude-task-master/commit/04e11b5e828597c0ba5b82ca7d5fb6f933e4f1e8) Thanks [@mm-parthy](https://github.com/mm-parthy)! - Add cross-tag task movement functionality for organizing tasks across different contexts.

  This feature enables moving tasks between different tags (contexts) in your project, making it easier to organize work across different branches, environments, or project phases.

  ## CLI Usage Examples

  Move a single task from one tag to another:

  ```bash
  # Move task 5 from backlog tag to in-progress tag
  task-master move --from=5 --from-tag=backlog --to-tag=feature-1

  # Move task with its dependencies
  task-master move --from=5 --from-tag=backlog --to-tag=feature-2 --with-dependencies

  # Move task without checking dependencies
  task-master move --from=5 --from-tag=backlog --to-tag=bug-3 --ignore-dependencies
  ```

  Move multiple tasks at once:

  ```bash
  # Move multiple tasks between tags
  task-master move --from=5,6,7 --from-tag=backlog --to-tag=bug-4 --with-dependencies
  ```

- [#1040](https://github.com/eyaltoledano/claude-task-master/pull/1040) [`fc47714`](https://github.com/eyaltoledano/claude-task-master/commit/fc477143400fd11d953727bf1b4277af5ad308d1) Thanks [@DomVidja](https://github.com/DomVidja)! - "Add Kilo Code profile integration with custom modes and MCP configuration"

- [#1054](https://github.com/eyaltoledano/claude-task-master/pull/1054) [`782728f`](https://github.com/eyaltoledano/claude-task-master/commit/782728ff95aa2e3b766d48273b57f6c6753e8573) Thanks [@martincik](https://github.com/martincik)! - Add compact mode --compact / -c flag to the `tm list` CLI command
  - outputs tasks in a minimal, git-style one-line format. This reduces verbose output from ~30+ lines of dashboards and tables to just 1 line per task, making it much easier to quickly scan available tasks.
    - Git-style format: ID STATUS TITLE (PRIORITY) → DEPS
    - Color-coded status, priority, and dependencies
    - Smart title truncation and dependency abbreviation
    - Subtask support with indentation
    - Full backward compatibility with existing list options

- [#1048](https://github.com/eyaltoledano/claude-task-master/pull/1048) [`e3ed4d7`](https://github.com/eyaltoledano/claude-task-master/commit/e3ed4d7c14b56894d7da675eb2b757423bea8f9d) Thanks [@joedanz](https://github.com/joedanz)! - Add CLI & MCP progress tracking for parse-prd command.

- [#1124](https://github.com/eyaltoledano/claude-task-master/pull/1124) [`95640dc`](https://github.com/eyaltoledano/claude-task-master/commit/95640dcde87ce7879858c0a951399fb49f3b6397) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add support for ollama `gpt-oss:20b` and `gpt-oss:120b`

- [#1123](https://github.com/eyaltoledano/claude-task-master/pull/1123) [`311b243`](https://github.com/eyaltoledano/claude-task-master/commit/311b2433e23c771c8d3a4d3f5ac577302b8321e5) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Remove `clear` Taskmaster claude code commands since they were too close to the claude-code clear command

### Patch Changes

- [#1131](https://github.com/eyaltoledano/claude-task-master/pull/1131) [`3dee60d`](https://github.com/eyaltoledano/claude-task-master/commit/3dee60dc3d566e3cff650accb30f994b8bb3a15e) Thanks [@joedanz](https://github.com/joedanz)! - Update Cursor one-click install link to new URL format

- [#1088](https://github.com/eyaltoledano/claude-task-master/pull/1088) [`04e11b5`](https://github.com/eyaltoledano/claude-task-master/commit/04e11b5e828597c0ba5b82ca7d5fb6f933e4f1e8) Thanks [@mm-parthy](https://github.com/mm-parthy)! - Fix `add-tag --from-branch` command error where `projectRoot` was not properly referenced

  The command was failing with "projectRoot is not defined" error because the code was directly referencing `projectRoot` instead of `context.projectRoot` in the git repository checks. This fix corrects the variable references to use the proper context object.

## 0.24.0

### Minor Changes

- [#1098](https://github.com/eyaltoledano/claude-task-master/pull/1098) [`36468f3`](https://github.com/eyaltoledano/claude-task-master/commit/36468f3c93faf4035a5c442ccbc501077f3440f1) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Enhanced Claude Code provider with codebase-aware task generation
  - Added automatic codebase analysis for Claude Code provider in `parse-prd`, `expand-task`, and `analyze-complexity` commands
  - When using Claude Code as the AI provider, Task Master now instructs the AI to analyze the project structure, existing implementations, and patterns before generating tasks or subtasks
  - Tasks and subtasks generated by Claude Code are now informed by actual codebase analysis, resulting in more accurate and contextual outputs

- [#1105](https://github.com/eyaltoledano/claude-task-master/pull/1105) [`75c514c`](https://github.com/eyaltoledano/claude-task-master/commit/75c514cf5b2ca47f95c0ad7fa92654a4f2a6be4b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add GPT-5 support with proper parameter handling
  - Added GPT-5 model to supported models configuration with SWE score of 0.749

- [#1091](https://github.com/eyaltoledano/claude-task-master/pull/1091) [`4bb6370`](https://github.com/eyaltoledano/claude-task-master/commit/4bb63706b80c28d1b2d782ba868a725326f916c7) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Claude Code subagent support with task-orchestrator, task-executor, and task-checker

  ## New Claude Code Agents

  Added specialized agents for Claude Code users to enable parallel task execution, intelligent task orchestration, and quality assurance:

  ### task-orchestrator

  Coordinates and manages the execution of Task Master tasks with intelligent dependency analysis:
  - Analyzes task dependencies to identify parallelizable work
  - Deploys multiple task-executor agents for concurrent execution
  - Monitors task completion and updates the dependency graph
  - Automatically identifies and starts newly unblocked tasks

  ### task-executor

  Handles the actual implementation of individual tasks:
  - Executes specific tasks identified by the orchestrator
  - Works on concrete implementation rather than planning
  - Updates task status and logs progress
  - Can work in parallel with other executors on independent tasks

  ### task-checker

  Verifies that completed tasks meet their specifications:
  - Reviews tasks marked as 'review' status
  - Validates implementation against requirements
  - Runs tests and checks for best practices
  - Ensures quality before marking tasks as 'done'

  ## Installation

  When using the Claude profile (`task-master rules add claude`), the agents are automatically installed to `.claude/agents/` directory.

  ## Usage Example

  ```bash
  # In Claude Code, after initializing a project with tasks:

  # Use task-orchestrator to analyze and coordinate work
  # The orchestrator will:
  # 1. Check task dependencies
  # 2. Identify tasks that can run in parallel
  # 3. Deploy executors for available work
  # 4. Monitor progress and deploy new executors as tasks complete

  # Use task-executor for specific task implementation
  # When the orchestrator identifies task 2.3 needs work:
  # The executor will implement that specific task
  ```

  ## Benefits
  - **Parallel Execution**: Multiple independent tasks can be worked on simultaneously
  - **Intelligent Scheduling**: Orchestrator understands dependencies and optimizes execution order
  - **Separation of Concerns**: Planning (orchestrator) is separated from execution (executor)
  - **Progress Tracking**: Real-time updates as tasks are completed
  - **Automatic Progression**: As tasks complete, newly unblocked tasks are automatically started

### Patch Changes

- [#1094](https://github.com/eyaltoledano/claude-task-master/pull/1094) [`4357af3`](https://github.com/eyaltoledano/claude-task-master/commit/4357af3f13859d90bca8795215e5d5f1d94abde5) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix expand task generating unrelated generic subtasks

  Fixed an issue where `task-master expand` would generate generic authentication-related subtasks regardless of the parent task context when using complexity reports. The expansion now properly includes the parent task details alongside any expansion guidance.

- [#1079](https://github.com/eyaltoledano/claude-task-master/pull/1079) [`e495b2b`](https://github.com/eyaltoledano/claude-task-master/commit/e495b2b55950ee54c7d0f1817d8530e28bd79c05) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix scope-up/down prompts to include all required fields for better AI model compatibility
  - Added missing `priority` field to scope adjustment prompts to prevent validation errors with Claude-code and other models
  - Ensures generated JSON includes all fields required by the schema

- [#1079](https://github.com/eyaltoledano/claude-task-master/pull/1079) [`e495b2b`](https://github.com/eyaltoledano/claude-task-master/commit/e495b2b55950ee54c7d0f1817d8530e28bd79c05) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP scope-up/down tools not finding tasks
  - Fixed task ID parsing in MCP layer - now correctly converts string IDs to numbers
  - scope_up_task and scope_down_task MCP tools now work properly

- [#1079](https://github.com/eyaltoledano/claude-task-master/pull/1079) [`e495b2b`](https://github.com/eyaltoledano/claude-task-master/commit/e495b2b55950ee54c7d0f1817d8530e28bd79c05) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve AI provider compatibility for JSON generation
  - Fixed schema compatibility issues between Perplexity and OpenAI o3 models
  - Removed nullable/default modifiers from Zod schemas for broader compatibility
  - Added automatic JSON repair for malformed AI responses (handles cases like missing array values)
  - Perplexity now uses JSON mode for more reliable structured output
  - Post-processing handles default values separately from schema validation

## 0.24.0-rc.2

### Minor Changes

- [#1105](https://github.com/eyaltoledano/claude-task-master/pull/1105) [`75c514c`](https://github.com/eyaltoledano/claude-task-master/commit/75c514cf5b2ca47f95c0ad7fa92654a4f2a6be4b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add GPT-5 support with proper parameter handling
  - Added GPT-5 model to supported models configuration with SWE score of 0.749

## 0.24.0-rc.1

### Minor Changes

- [#1093](https://github.com/eyaltoledano/claude-task-master/pull/1093) [`36468f3`](https://github.com/eyaltoledano/claude-task-master/commit/36468f3c93faf4035a5c442ccbc501077f3440f1) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Enhanced Claude Code provider with codebase-aware task generation
  - Added automatic codebase analysis for Claude Code provider in `parse-prd`, `expand-task`, and `analyze-complexity` commands
  - When using Claude Code as the AI provider, Task Master now instructs the AI to analyze the project structure, existing implementations, and patterns before generating tasks or subtasks
  - Tasks and subtasks generated by Claude Code are now informed by actual codebase analysis, resulting in more accurate and contextual outputs

- [#1091](https://github.com/eyaltoledano/claude-task-master/pull/1091) [`4bb6370`](https://github.com/eyaltoledano/claude-task-master/commit/4bb63706b80c28d1b2d782ba868a725326f916c7) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Claude Code subagent support with task-orchestrator, task-executor, and task-checker

  ## New Claude Code Agents

  Added specialized agents for Claude Code users to enable parallel task execution, intelligent task orchestration, and quality assurance:

  ### task-orchestrator

  Coordinates and manages the execution of Task Master tasks with intelligent dependency analysis:
  - Analyzes task dependencies to identify parallelizable work
  - Deploys multiple task-executor agents for concurrent execution
  - Monitors task completion and updates the dependency graph
  - Automatically identifies and starts newly unblocked tasks

  ### task-executor

  Handles the actual implementation of individual tasks:
  - Executes specific tasks identified by the orchestrator
  - Works on concrete implementation rather than planning
  - Updates task status and logs progress
  - Can work in parallel with other executors on independent tasks

  ### task-checker

  Verifies that completed tasks meet their specifications:
  - Reviews tasks marked as 'review' status
  - Validates implementation against requirements
  - Runs tests and checks for best practices
  - Ensures quality before marking tasks as 'done'

  ## Installation

  When using the Claude profile (`task-master rules add claude`), the agents are automatically installed to `.claude/agents/` directory.

  ## Usage Example

  ```bash
  # In Claude Code, after initializing a project with tasks:

  # Use task-orchestrator to analyze and coordinate work
  # The orchestrator will:
  # 1. Check task dependencies
  # 2. Identify tasks that can run in parallel
  # 3. Deploy executors for available work
  # 4. Monitor progress and deploy new executors as tasks complete

  # Use task-executor for specific task implementation
  # When the orchestrator identifies task 2.3 needs work:
  # The executor will implement that specific task
  ```

  ## Benefits
  - **Parallel Execution**: Multiple independent tasks can be worked on simultaneously
  - **Intelligent Scheduling**: Orchestrator understands dependencies and optimizes execution order
  - **Separation of Concerns**: Planning (orchestrator) is separated from execution (executor)
  - **Progress Tracking**: Real-time updates as tasks are completed
  - **Automatic Progression**: As tasks complete, newly unblocked tasks are automatically started

### Patch Changes

- [#1094](https://github.com/eyaltoledano/claude-task-master/pull/1094) [`4357af3`](https://github.com/eyaltoledano/claude-task-master/commit/4357af3f13859d90bca8795215e5d5f1d94abde5) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix expand task generating unrelated generic subtasks

  Fixed an issue where `task-master expand` would generate generic authentication-related subtasks regardless of the parent task context when using complexity reports. The expansion now properly includes the parent task details alongside any expansion guidance.

## 0.23.1-rc.0

### Patch Changes

- [#1079](https://github.com/eyaltoledano/claude-task-master/pull/1079) [`e495b2b`](https://github.com/eyaltoledano/claude-task-master/commit/e495b2b55950ee54c7d0f1817d8530e28bd79c05) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix scope-up/down prompts to include all required fields for better AI model compatibility
  - Added missing `priority` field to scope adjustment prompts to prevent validation errors with Claude-code and other models
  - Ensures generated JSON includes all fields required by the schema

- [#1079](https://github.com/eyaltoledano/claude-task-master/pull/1079) [`e495b2b`](https://github.com/eyaltoledano/claude-task-master/commit/e495b2b55950ee54c7d0f1817d8530e28bd79c05) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP scope-up/down tools not finding tasks
  - Fixed task ID parsing in MCP layer - now correctly converts string IDs to numbers
  - scope_up_task and scope_down_task MCP tools now work properly

- [#1079](https://github.com/eyaltoledano/claude-task-master/pull/1079) [`e495b2b`](https://github.com/eyaltoledano/claude-task-master/commit/e495b2b55950ee54c7d0f1817d8530e28bd79c05) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve AI provider compatibility for JSON generation
  - Fixed schema compatibility issues between Perplexity and OpenAI o3 models
  - Removed nullable/default modifiers from Zod schemas for broader compatibility
  - Added automatic JSON repair for malformed AI responses (handles cases like missing array values)
  - Perplexity now uses JSON mode for more reliable structured output
  - Post-processing handles default values separately from schema validation

## 0.23.0

### Minor Changes

- [#1064](https://github.com/eyaltoledano/claude-task-master/pull/1064) [`53903f1`](https://github.com/eyaltoledano/claude-task-master/commit/53903f1e8eee23ac512eb13a6d81d8cbcfe658cb) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add new `scope-up` and `scope-down` commands for dynamic task complexity adjustment

  This release introduces two powerful new commands that allow you to dynamically adjust the complexity of your tasks and subtasks without recreating them from scratch.

  **New CLI Commands:**
  - `task-master scope-up` - Increase task complexity (add more detail, requirements, or implementation steps)
  - `task-master scope-down` - Decrease task complexity (simplify, remove unnecessary details, or streamline)

  **Key Features:**
  - **Multiple tasks**: Support comma-separated IDs to adjust multiple tasks at once (`--id=5,7,12`)
  - **Strength levels**: Choose adjustment intensity with `--strength=light|regular|heavy` (defaults to regular)
  - **Custom prompts**: Use `--prompt` flag to specify exactly how you want tasks adjusted
  - **MCP integration**: Available as `scope_up_task` and `scope_down_task` tools in Cursor and other MCP environments
  - **Smart context**: AI considers your project context and task dependencies when making adjustments

  **Usage Examples:**

  ```bash
  # Make a task more detailed
  task-master scope-up --id=5

  # Simplify multiple tasks with light touch
  task-master scope-down --id=10,11,12 --strength=light

  # Custom adjustment with specific instructions
  task-master scope-up --id=7 --prompt="Add more error handling and edge cases"
  ```

  **Why use this?**
  - **Iterative refinement**: Adjust task complexity as your understanding evolves
  - **Project phase adaptation**: Scale tasks up for implementation, down for planning
  - **Team coordination**: Adjust complexity based on team member experience levels
  - **Milestone alignment**: Fine-tune tasks to match project phase requirements

  Perfect for agile workflows where task requirements change as you learn more about the problem space.

### Patch Changes

- [#1063](https://github.com/eyaltoledano/claude-task-master/pull/1063) [`2ae6e7e`](https://github.com/eyaltoledano/claude-task-master/commit/2ae6e7e6be3605c3c4d353f34666e54750dba973) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix for tasks not found when using string IDs

- [#1049](https://github.com/eyaltoledano/claude-task-master/pull/1049) [`45a14c3`](https://github.com/eyaltoledano/claude-task-master/commit/45a14c323d21071c15106335e89ad1f4a20976ab) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Fix tag-specific complexity report detection in expand command

  The expand command now correctly finds and uses tag-specific complexity reports (e.g., `task-complexity-report_feature-xyz.json`) when operating in a tag context. Previously, it would always look for the generic `task-complexity-report.json` file due to a default value in the CLI option definition.

## 0.23.0-rc.2

### Minor Changes

- [#1064](https://github.com/eyaltoledano/claude-task-master/pull/1064) [`53903f1`](https://github.com/eyaltoledano/claude-task-master/commit/53903f1e8eee23ac512eb13a6d81d8cbcfe658cb) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add new `scope-up` and `scope-down` commands for dynamic task complexity adjustment

  This release introduces two powerful new commands that allow you to dynamically adjust the complexity of your tasks and subtasks without recreating them from scratch.

  **New CLI Commands:**
  - `task-master scope-up` - Increase task complexity (add more detail, requirements, or implementation steps)
  - `task-master scope-down` - Decrease task complexity (simplify, remove unnecessary details, or streamline)

  **Key Features:**
  - **Multiple tasks**: Support comma-separated IDs to adjust multiple tasks at once (`--id=5,7,12`)
  - **Strength levels**: Choose adjustment intensity with `--strength=light|regular|heavy` (defaults to regular)
  - **Custom prompts**: Use `--prompt` flag to specify exactly how you want tasks adjusted
  - **MCP integration**: Available as `scope_up_task` and `scope_down_task` tools in Cursor and other MCP environments
  - **Smart context**: AI considers your project context and task dependencies when making adjustments

  **Usage Examples:**

  ```bash
  # Make a task more detailed
  task-master scope-up --id=5

  # Simplify multiple tasks with light touch
  task-master scope-down --id=10,11,12 --strength=light

  # Custom adjustment with specific instructions
  task-master scope-up --id=7 --prompt="Add more error handling and edge cases"
  ```

  **Why use this?**
  - **Iterative refinement**: Adjust task complexity as your understanding evolves
  - **Project phase adaptation**: Scale tasks up for implementation, down for planning
  - **Team coordination**: Adjust complexity based on team member experience levels
  - **Milestone alignment**: Fine-tune tasks to match project phase requirements

  Perfect for agile workflows where task requirements change as you learn more about the problem space.

## 0.22.1-rc.1

### Patch Changes

- [#1069](https://github.com/eyaltoledano/claude-task-master/pull/1069) [`72ca68e`](https://github.com/eyaltoledano/claude-task-master/commit/72ca68edeb870ff7a3b0d2d632e09dae921dc16a) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add new `scope-up` and `scope-down` commands for dynamic task complexity adjustment

  This release introduces two powerful new commands that allow you to dynamically adjust the complexity of your tasks and subtasks without recreating them from scratch.

  **New CLI Commands:**
  - `task-master scope-up` - Increase task complexity (add more detail, requirements, or implementation steps)
  - `task-master scope-down` - Decrease task complexity (simplify, remove unnecessary details, or streamline)

  **Key Features:**
  - **Multiple tasks**: Support comma-separated IDs to adjust multiple tasks at once (`--id=5,7,12`)
  - **Strength levels**: Choose adjustment intensity with `--strength=light|regular|heavy` (defaults to regular)
  - **Custom prompts**: Use `--prompt` flag to specify exactly how you want tasks adjusted
  - **MCP integration**: Available as `scope_up_task` and `scope_down_task` tools in Cursor and other MCP environments
  - **Smart context**: AI considers your project context and task dependencies when making adjustments

  **Usage Examples:**

  ```bash
  # Make a task more detailed
  task-master scope-up --id=5

  # Simplify multiple tasks with light touch
  task-master scope-down --id=10,11,12 --strength=light

  # Custom adjustment with specific instructions
  task-master scope-up --id=7 --prompt="Add more error handling and edge cases"
  ```

  **Why use this?**
  - **Iterative refinement**: Adjust task complexity as your understanding evolves
  - **Project phase adaptation**: Scale tasks up for implementation, down for planning
  - **Team coordination**: Adjust complexity based on team member experience levels
  - **Milestone alignment**: Fine-tune tasks to match project phase requirements

  Perfect for agile workflows where task requirements change as you learn more about the problem space.

## 0.22.1-rc.0

### Patch Changes

- [#1063](https://github.com/eyaltoledano/claude-task-master/pull/1063) [`2ae6e7e`](https://github.com/eyaltoledano/claude-task-master/commit/2ae6e7e6be3605c3c4d353f34666e54750dba973) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix for tasks not found when using string IDs

- [#1049](https://github.com/eyaltoledano/claude-task-master/pull/1049) [`45a14c3`](https://github.com/eyaltoledano/claude-task-master/commit/45a14c323d21071c15106335e89ad1f4a20976ab) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Fix tag-specific complexity report detection in expand command

  The expand command now correctly finds and uses tag-specific complexity reports (e.g., `task-complexity-report_feature-xyz.json`) when operating in a tag context. Previously, it would always look for the generic `task-complexity-report.json` file due to a default value in the CLI option definition.

## 0.22.0

### Minor Changes

- [#1043](https://github.com/eyaltoledano/claude-task-master/pull/1043) [`dc44ed9`](https://github.com/eyaltoledano/claude-task-master/commit/dc44ed9de8a57aca5d39d3a87565568bd0a82068) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Prompt to generate a complexity report when it is missing

- [#1032](https://github.com/eyaltoledano/claude-task-master/pull/1032) [`4423119`](https://github.com/eyaltoledano/claude-task-master/commit/4423119a5ec53958c9dffa8bf564da8be7a2827d) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add comprehensive Kiro IDE integration with autonomous task management hooks
  - **Kiro Profile**: Added full support for Kiro IDE with automatic installation of 7 Taskmaster agent hooks
  - **Hook-Driven Workflow**: Introduced natural language automation hooks that eliminate manual task status updates
  - **Automatic Hook Installation**: Hooks are now automatically copied to `.kiro/hooks/` when running `task-master rules add kiro`
  - **Language-Agnostic Support**: All hooks support multiple programming languages (JS, Python, Go, Rust, Java, etc.)
  - **Frontmatter Transformation**: Kiro rules use simplified `inclusion: always` format instead of Cursor's complex frontmatter
  - **Special Rule**: Added `taskmaster_hooks_workflow.md` that guides AI assistants to prefer hook-driven completion

  Key hooks included:
  - Task Dependency Auto-Progression: Automatically starts tasks when dependencies complete
  - Code Change Task Tracker: Updates task progress as you save files
  - Test Success Task Completer: Marks tasks done when tests pass
  - Daily Standup Assistant: Provides personalized task status summaries
  - PR Readiness Checker: Validates task completion before creating pull requests
  - Complexity Analyzer: Auto-expands complex tasks into manageable subtasks
  - Git Commit Task Linker: Links commits to tasks for better traceability

  This creates a truly autonomous development workflow where task management happens naturally as you code!

### Patch Changes

- [#1033](https://github.com/eyaltoledano/claude-task-master/pull/1033) [`7b90568`](https://github.com/eyaltoledano/claude-task-master/commit/7b9056832653464f934c91c22997077065d738c4) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Fix compatibility with @google/gemini-cli-core v0.1.12+ by updating ai-sdk-provider-gemini-cli to v0.1.1.

- [#1038](https://github.com/eyaltoledano/claude-task-master/pull/1038) [`77cc5e4`](https://github.com/eyaltoledano/claude-task-master/commit/77cc5e4537397642f2664f61940a101433ee6fb4) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix 'expand --all' and 'show' commands to correctly handle tag contexts for complexity reports and task display.

- [#1025](https://github.com/eyaltoledano/claude-task-master/pull/1025) [`8781794`](https://github.com/eyaltoledano/claude-task-master/commit/8781794c56d454697fc92c88a3925982d6b81205) Thanks [@joedanz](https://github.com/joedanz)! - Clean up remaining automatic task file generation calls

- [#1035](https://github.com/eyaltoledano/claude-task-master/pull/1035) [`fb7d588`](https://github.com/eyaltoledano/claude-task-master/commit/fb7d588137e8c53b0d0f54bd1dd8d387648583ee) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix max_tokens limits for OpenRouter and Groq models
  - Add special handling in config-manager.js for custom OpenRouter models to use a conservative default of 32,768 max_tokens
  - Update qwen/qwen-turbo model max_tokens from 1,000,000 to 32,768 to match OpenRouter's actual limits
  - Fix moonshotai/kimi-k2-instruct max_tokens to 16,384 to match Groq's actual limit (fixes #1028)
  - This prevents "maximum context length exceeded" errors when using OpenRouter models not in our supported models list

- [#1027](https://github.com/eyaltoledano/claude-task-master/pull/1027) [`6ae66b2`](https://github.com/eyaltoledano/claude-task-master/commit/6ae66b2afbfe911340fa25e0236c3db83deaa7eb) Thanks [@andreswebs](https://github.com/andreswebs)! - Fix VSCode profile generation to use correct rule file names (using `.instructions.md` extension instead of `.md`) and front-matter properties (removing the unsupported `alwaysApply` property from instructions files' front-matter).

## 0.22.0-rc.1

### Minor Changes

- [#1043](https://github.com/eyaltoledano/claude-task-master/pull/1043) [`dc44ed9`](https://github.com/eyaltoledano/claude-task-master/commit/dc44ed9de8a57aca5d39d3a87565568bd0a82068) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Prompt to generate a complexity report when it is missing

## 0.22.0-rc.0

### Minor Changes

- [#1032](https://github.com/eyaltoledano/claude-task-master/pull/1032) [`4423119`](https://github.com/eyaltoledano/claude-task-master/commit/4423119a5ec53958c9dffa8bf564da8be7a2827d) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add comprehensive Kiro IDE integration with autonomous task management hooks
  - **Kiro Profile**: Added full support for Kiro IDE with automatic installation of 7 Taskmaster agent hooks
  - **Hook-Driven Workflow**: Introduced natural language automation hooks that eliminate manual task status updates
  - **Automatic Hook Installation**: Hooks are now automatically copied to `.kiro/hooks/` when running `task-master rules add kiro`
  - **Language-Agnostic Support**: All hooks support multiple programming languages (JS, Python, Go, Rust, Java, etc.)
  - **Frontmatter Transformation**: Kiro rules use simplified `inclusion: always` format instead of Cursor's complex frontmatter
  - **Special Rule**: Added `taskmaster_hooks_workflow.md` that guides AI assistants to prefer hook-driven completion

  Key hooks included:
  - Task Dependency Auto-Progression: Automatically starts tasks when dependencies complete
  - Code Change Task Tracker: Updates task progress as you save files
  - Test Success Task Completer: Marks tasks done when tests pass
  - Daily Standup Assistant: Provides personalized task status summaries
  - PR Readiness Checker: Validates task completion before creating pull requests
  - Complexity Analyzer: Auto-expands complex tasks into manageable subtasks
  - Git Commit Task Linker: Links commits to tasks for better traceability

  This creates a truly autonomous development workflow where task management happens naturally as you code!

### Patch Changes

- [#1033](https://github.com/eyaltoledano/claude-task-master/pull/1033) [`7b90568`](https://github.com/eyaltoledano/claude-task-master/commit/7b9056832653464f934c91c22997077065d738c4) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Fix compatibility with @google/gemini-cli-core v0.1.12+ by updating ai-sdk-provider-gemini-cli to v0.1.1.

- [#1038](https://github.com/eyaltoledano/claude-task-master/pull/1038) [`77cc5e4`](https://github.com/eyaltoledano/claude-task-master/commit/77cc5e4537397642f2664f61940a101433ee6fb4) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix 'expand --all' and 'show' commands to correctly handle tag contexts for complexity reports and task display.

- [#1025](https://github.com/eyaltoledano/claude-task-master/pull/1025) [`8781794`](https://github.com/eyaltoledano/claude-task-master/commit/8781794c56d454697fc92c88a3925982d6b81205) Thanks [@joedanz](https://github.com/joedanz)! - Clean up remaining automatic task file generation calls

- [#1035](https://github.com/eyaltoledano/claude-task-master/pull/1035) [`fb7d588`](https://github.com/eyaltoledano/claude-task-master/commit/fb7d588137e8c53b0d0f54bd1dd8d387648583ee) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix max_tokens limits for OpenRouter and Groq models
  - Add special handling in config-manager.js for custom OpenRouter models to use a conservative default of 32,768 max_tokens
  - Update qwen/qwen-turbo model max_tokens from 1,000,000 to 32,768 to match OpenRouter's actual limits
  - Fix moonshotai/kimi-k2-instruct max_tokens to 16,384 to match Groq's actual limit (fixes #1028)
  - This prevents "maximum context length exceeded" errors when using OpenRouter models not in our supported models list

- [#1027](https://github.com/eyaltoledano/claude-task-master/pull/1027) [`6ae66b2`](https://github.com/eyaltoledano/claude-task-master/commit/6ae66b2afbfe911340fa25e0236c3db83deaa7eb) Thanks [@andreswebs](https://github.com/andreswebs)! - Fix VSCode profile generation to use correct rule file names (using `.instructions.md` extension instead of `.md`) and front-matter properties (removing the unsupported `alwaysApply` property from instructions files' front-matter).

## 0.21.0

### Minor Changes

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`9c58a92`](https://github.com/eyaltoledano/claude-task-master/commit/9c58a922436c0c5e7ff1b20ed2edbc269990c772) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Kiro editor rule profile support
  - Add support for Kiro IDE with custom rule files and MCP configuration
  - Generate rule files in `.kiro/steering/` directory with markdown format
  - Include MCP server configuration with enhanced file inclusion patterns

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`444aa5a`](https://github.com/eyaltoledano/claude-task-master/commit/444aa5ae1943ba72d012b3f01b1cc9362a328248) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Created a comprehensive documentation site for Task Master AI. Visit https://docs.task-master.dev to explore guides, API references, and examples.

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`58a301c`](https://github.com/eyaltoledano/claude-task-master/commit/58a301c380d18a9d9509137f3e989d24200a5faa) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Complete Groq provider integration and add MoonshotAI Kimi K2 model support
  - Fixed Groq provider registration
  - Added Groq API key validation
  - Added GROQ_API_KEY to .env.example
  - Added moonshotai/kimi-k2-instruct model with $1/$3 per 1M token pricing and 16k max output

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`b0e09c7`](https://github.com/eyaltoledano/claude-task-master/commit/b0e09c76ed73b00434ac95606679f570f1015a3d) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - feat: Add Zed editor rule profile with agent rules and MCP config
  - Resolves #637

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`6c5e0f9`](https://github.com/eyaltoledano/claude-task-master/commit/6c5e0f97f8403c4da85c1abba31cb8b1789511a7) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Amp rule profile with AGENT.md and MCP config

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`444aa5a`](https://github.com/eyaltoledano/claude-task-master/commit/444aa5ae1943ba72d012b3f01b1cc9362a328248) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve project root detection
  - No longer creates an infinite loop when unable to detect your code workspace

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`36c4a7a`](https://github.com/eyaltoledano/claude-task-master/commit/36c4a7a86924c927ad7f86a4f891f66ad55eb4d2) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add OpenCode profile with AGENTS.md and MCP config
  - Resolves #965

### Patch Changes

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`444aa5a`](https://github.com/eyaltoledano/claude-task-master/commit/444aa5ae1943ba72d012b3f01b1cc9362a328248) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Make `task-master update` more reliable with AI responses

  The `update` command now handles AI responses more robustly. If the AI forgets to include certain task fields, the command will automatically fill in the missing data from your original tasks instead of failing. This means smoother bulk task updates without losing important information like IDs, dependencies, or completed subtasks.

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`444aa5a`](https://github.com/eyaltoledano/claude-task-master/commit/444aa5ae1943ba72d012b3f01b1cc9362a328248) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix subtask dependency validation when expanding tasks

  When using `task-master expand` to break down tasks into subtasks, dependencies between subtasks are now properly validated. Previously, subtasks with dependencies would fail validation. Now subtasks can correctly depend on their siblings within the same parent task.

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`6d69d02`](https://github.com/eyaltoledano/claude-task-master/commit/6d69d02fe03edcc785380415995d5cfcdd97acbb) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Prevent CLAUDE.md overwrite by using Claude Code's import feature
  - Task Master now creates its instructions in `.taskmaster/CLAUDE.md` instead of overwriting the user's `CLAUDE.md`
  - Adds an import section to the user's CLAUDE.md that references the Task Master instructions
  - Preserves existing user content in CLAUDE.md files
  - Provides clean uninstall that only removes Task Master's additions

  **Breaking Change**: Task Master instructions for Claude Code are now stored in `.taskmaster/CLAUDE.md` and imported into the main CLAUDE.md file. Users who previously had Task Master content directly in their CLAUDE.md will need to run `task-master rules remove claude` followed by `task-master rules add claude` to migrate to the new structure.

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`fd005c4`](https://github.com/eyaltoledano/claude-task-master/commit/fd005c4c5481ffac58b11f01a448fa5b29056b8d) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Implement Boundary-First Tag Resolution to ensure consistent and deterministic tag handling across CLI and MCP, resolving potential race conditions.

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`444aa5a`](https://github.com/eyaltoledano/claude-task-master/commit/444aa5ae1943ba72d012b3f01b1cc9362a328248) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix `task-master lang --setup` breaking when no language is defined, now defaults to English

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`624922c`](https://github.com/eyaltoledano/claude-task-master/commit/624922ca598c4ce8afe9a5646ebb375d4616db63) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix: show command no longer requires complexity report file to exist

  The `tm show` command was incorrectly requiring the complexity report file to exist even when not needed. Now it only validates the complexity report path when a custom report file is explicitly provided via the -r/--report option.

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`858d4a1`](https://github.com/eyaltoledano/claude-task-master/commit/858d4a1c5486d20e7e3a8e37e3329d7fb8200310) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Update VS Code profile with MCP config transformation

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`0451ebc`](https://github.com/eyaltoledano/claude-task-master/commit/0451ebcc32cd7e9d395b015aaa8602c4734157e1) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP server error when retrieving tools and resources

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`0a70ab6`](https://github.com/eyaltoledano/claude-task-master/commit/0a70ab6179cb2b5b4b2d9dc256a7a3b69a0e5dd6) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add MCP configuration support to Claude Code rules

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`4629128`](https://github.com/eyaltoledano/claude-task-master/commit/4629128943f6283385f4762c09cf2752f855cc33) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fixed the comprehensive taskmaster system integration via custom slash commands with proper syntax
  - Provide claude clode with a complete set of of commands that can trigger task master events directly within Claude Code

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`0886c83`](https://github.com/eyaltoledano/claude-task-master/commit/0886c83d0c678417c0313256a6dd96f7ee2c9ac6) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Correct MCP server name and use 'Add to Cursor' button with updated placeholder keys.

- [#1009](https://github.com/eyaltoledano/claude-task-master/pull/1009) [`88c434a`](https://github.com/eyaltoledano/claude-task-master/commit/88c434a9393e429d9277f59b3e20f1005076bbe0) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add missing API keys to .env.example and README.md

## 0.21.0-rc.0

### Minor Changes

- [#1001](https://github.com/eyaltoledano/claude-task-master/pull/1001) [`75a36ea`](https://github.com/eyaltoledano/claude-task-master/commit/75a36ea99a1c738a555bdd4fe7c763d0c5925e37) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Kiro editor rule profile support
  - Add support for Kiro IDE with custom rule files and MCP configuration
  - Generate rule files in `.kiro/steering/` directory with markdown format
  - Include MCP server configuration with enhanced file inclusion patterns

- [#1011](https://github.com/eyaltoledano/claude-task-master/pull/1011) [`3eb050a`](https://github.com/eyaltoledano/claude-task-master/commit/3eb050aaddb90fca1a04517e2ee24f73934323be) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Created a comprehensive documentation site for Task Master AI. Visit https://docs.task-master.dev to explore guides, API references, and examples.

- [#978](https://github.com/eyaltoledano/claude-task-master/pull/978) [`fedfd6a`](https://github.com/eyaltoledano/claude-task-master/commit/fedfd6a0f41a78094f7ee7f69be689b699475a79) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Complete Groq provider integration and add MoonshotAI Kimi K2 model support
  - Fixed Groq provider registration
  - Added Groq API key validation
  - Added GROQ_API_KEY to .env.example
  - Added moonshotai/kimi-k2-instruct model with $1/$3 per 1M token pricing and 16k max output

- [#974](https://github.com/eyaltoledano/claude-task-master/pull/974) [`5b0eda0`](https://github.com/eyaltoledano/claude-task-master/commit/5b0eda07f20a365aa2ec1736eed102bca81763a9) Thanks [@joedanz](https://github.com/joedanz)! - feat: Add Zed editor rule profile with agent rules and MCP config
  - Resolves #637

- [#973](https://github.com/eyaltoledano/claude-task-master/pull/973) [`6d05e86`](https://github.com/eyaltoledano/claude-task-master/commit/6d05e8622c1d761acef10414940ff9a766b3b57d) Thanks [@joedanz](https://github.com/joedanz)! - Add Amp rule profile with AGENT.md and MCP config

- [#1011](https://github.com/eyaltoledano/claude-task-master/pull/1011) [`3eb050a`](https://github.com/eyaltoledano/claude-task-master/commit/3eb050aaddb90fca1a04517e2ee24f73934323be) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve project root detection
  - No longer creates an infinite loop when unable to detect your code workspace

- [#970](https://github.com/eyaltoledano/claude-task-master/pull/970) [`b87499b`](https://github.com/eyaltoledano/claude-task-master/commit/b87499b56e626001371a87ed56ffc72675d829f3) Thanks [@joedanz](https://github.com/joedanz)! - Add OpenCode profile with AGENTS.md and MCP config
  - Resolves #965

### Patch Changes

- [#1011](https://github.com/eyaltoledano/claude-task-master/pull/1011) [`3eb050a`](https://github.com/eyaltoledano/claude-task-master/commit/3eb050aaddb90fca1a04517e2ee24f73934323be) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Make `task-master update` more reliable with AI responses

  The `update` command now handles AI responses more robustly. If the AI forgets to include certain task fields, the command will automatically fill in the missing data from your original tasks instead of failing. This means smoother bulk task updates without losing important information like IDs, dependencies, or completed subtasks.

- [#1011](https://github.com/eyaltoledano/claude-task-master/pull/1011) [`3eb050a`](https://github.com/eyaltoledano/claude-task-master/commit/3eb050aaddb90fca1a04517e2ee24f73934323be) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix subtask dependency validation when expanding tasks

  When using `task-master expand` to break down tasks into subtasks, dependencies between subtasks are now properly validated. Previously, subtasks with dependencies would fail validation. Now subtasks can correctly depend on their siblings within the same parent task.

- [#949](https://github.com/eyaltoledano/claude-task-master/pull/949) [`f662654`](https://github.com/eyaltoledano/claude-task-master/commit/f662654afb8e7a230448655265d6f41adf6df62c) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Prevent CLAUDE.md overwrite by using Claude Code's import feature
  - Task Master now creates its instructions in `.taskmaster/CLAUDE.md` instead of overwriting the user's `CLAUDE.md`
  - Adds an import section to the user's CLAUDE.md that references the Task Master instructions
  - Preserves existing user content in CLAUDE.md files
  - Provides clean uninstall that only removes Task Master's additions

  **Breaking Change**: Task Master instructions for Claude Code are now stored in `.taskmaster/CLAUDE.md` and imported into the main CLAUDE.md file. Users who previously had Task Master content directly in their CLAUDE.md will need to run `task-master rules remove claude` followed by `task-master rules add claude` to migrate to the new structure.

- [#943](https://github.com/eyaltoledano/claude-task-master/pull/943) [`f98df5c`](https://github.com/eyaltoledano/claude-task-master/commit/f98df5c0fdb253b2b55d4278c11d626529c4dba4) Thanks [@mm-parthy](https://github.com/mm-parthy)! - Implement Boundary-First Tag Resolution to ensure consistent and deterministic tag handling across CLI and MCP, resolving potential race conditions.

- [#1011](https://github.com/eyaltoledano/claude-task-master/pull/1011) [`3eb050a`](https://github.com/eyaltoledano/claude-task-master/commit/3eb050aaddb90fca1a04517e2ee24f73934323be) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix `task-master lang --setup` breaking when no language is defined, now defaults to English

- [#979](https://github.com/eyaltoledano/claude-task-master/pull/979) [`ab2e946`](https://github.com/eyaltoledano/claude-task-master/commit/ab2e94608749a2f148118daa0443bd32bca6e7a1) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Fix: show command no longer requires complexity report file to exist

  The `tm show` command was incorrectly requiring the complexity report file to exist even when not needed. Now it only validates the complexity report path when a custom report file is explicitly provided via the -r/--report option.

- [#971](https://github.com/eyaltoledano/claude-task-master/pull/971) [`5544222`](https://github.com/eyaltoledano/claude-task-master/commit/55442226d0aa4870470d2a9897f5538d6a0e329e) Thanks [@joedanz](https://github.com/joedanz)! - Update VS Code profile with MCP config transformation

- [#1002](https://github.com/eyaltoledano/claude-task-master/pull/1002) [`6d0654c`](https://github.com/eyaltoledano/claude-task-master/commit/6d0654cb4191cee794e1c8cbf2b92dc33d4fb410) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP server error when retrieving tools and resources

- [#980](https://github.com/eyaltoledano/claude-task-master/pull/980) [`cc4fe20`](https://github.com/eyaltoledano/claude-task-master/commit/cc4fe205fb468e7144c650acc92486df30731560) Thanks [@joedanz](https://github.com/joedanz)! - Add MCP configuration support to Claude Code rules

- [#968](https://github.com/eyaltoledano/claude-task-master/pull/968) [`7b4803a`](https://github.com/eyaltoledano/claude-task-master/commit/7b4803a479105691c7ed032fd878fe3d48d82724) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fixed the comprehensive taskmaster system integration via custom slash commands with proper syntax
  - Provide claude clode with a complete set of of commands that can trigger task master events directly within Claude Code

- [#995](https://github.com/eyaltoledano/claude-task-master/pull/995) [`b78de8d`](https://github.com/eyaltoledano/claude-task-master/commit/b78de8dbb4d6dc93b48e2f81c32960ef069736ed) Thanks [@joedanz](https://github.com/joedanz)! - Correct MCP server name and use 'Add to Cursor' button with updated placeholder keys.

- [#972](https://github.com/eyaltoledano/claude-task-master/pull/972) [`1c7badf`](https://github.com/eyaltoledano/claude-task-master/commit/1c7badff2f5c548bfa90a3b2634e63087a382a84) Thanks [@joedanz](https://github.com/joedanz)! - Add missing API keys to .env.example and README.md

## 0.20.0

### Minor Changes

- [#950](https://github.com/eyaltoledano/claude-task-master/pull/950) [`699e9ee`](https://github.com/eyaltoledano/claude-task-master/commit/699e9eefb5d687b256e9402d686bdd5e3a358b4a) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Add support for xAI Grok 4 model
  - Add grok-4 model to xAI provider with $3/$15 per 1M token pricing
  - Enable main, fallback, and research roles for grok-4
  - Max tokens set to 131,072 (matching other xAI models)

- [#946](https://github.com/eyaltoledano/claude-task-master/pull/946) [`5f009a5`](https://github.com/eyaltoledano/claude-task-master/commit/5f009a5e1fc10e37be26f5135df4b7f44a9c5320) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add stricter validation and clearer feedback for task priority when adding new tasks
  - if a task priority is invalid, it will default to medium
  - made taks priority case-insensitive, essentially making HIGH and high the same value

- [#863](https://github.com/eyaltoledano/claude-task-master/pull/863) [`b530657`](https://github.com/eyaltoledano/claude-task-master/commit/b53065713c8da0ae6f18eb2655397aa975004923) Thanks [@OrenMe](https://github.com/OrenMe)! - Add support for MCP Sampling as AI provider, requires no API key, uses the client LLM provider

- [#930](https://github.com/eyaltoledano/claude-task-master/pull/930) [`98d1c97`](https://github.com/eyaltoledano/claude-task-master/commit/98d1c974361a56ddbeb772b1272986b9d3913459) Thanks [@OmarElKadri](https://github.com/OmarElKadri)! - Added Groq provider support

### Patch Changes

- [#958](https://github.com/eyaltoledano/claude-task-master/pull/958) [`6c88a4a`](https://github.com/eyaltoledano/claude-task-master/commit/6c88a4a749083e3bd2d073a9240799771774495a) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Recover from `@anthropic-ai/claude-code` JSON truncation bug that caused Task Master to crash when handling large (>8 kB) structured responses. The CLI/SDK still truncates, but Task Master now detects the error, preserves buffered text, and returns a usable response instead of throwing.

- [#958](https://github.com/eyaltoledano/claude-task-master/pull/958) [`3334e40`](https://github.com/eyaltoledano/claude-task-master/commit/3334e409ae659d5223bb136ae23fd22c5e219073) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Updating dependency ai-sdk-provider-gemini-cli to 0.0.4 to address breaking change Google made to Gemini CLI and add better 'api-key' in addition to 'gemini-api-key' AI-SDK compatibility.

- [#853](https://github.com/eyaltoledano/claude-task-master/pull/853) [`95c299d`](https://github.com/eyaltoledano/claude-task-master/commit/95c299df642bd8e6d75f8fa5110ac705bcc72edf) Thanks [@joedanz](https://github.com/joedanz)! - Unify and streamline profile system architecture for improved maintainability

## 0.20.0-rc.0

### Minor Changes

- [#950](https://github.com/eyaltoledano/claude-task-master/pull/950) [`699e9ee`](https://github.com/eyaltoledano/claude-task-master/commit/699e9eefb5d687b256e9402d686bdd5e3a358b4a) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Add support for xAI Grok 4 model
  - Add grok-4 model to xAI provider with $3/$15 per 1M token pricing
  - Enable main, fallback, and research roles for grok-4
  - Max tokens set to 131,072 (matching other xAI models)

- [#946](https://github.com/eyaltoledano/claude-task-master/pull/946) [`5f009a5`](https://github.com/eyaltoledano/claude-task-master/commit/5f009a5e1fc10e37be26f5135df4b7f44a9c5320) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add stricter validation and clearer feedback for task priority when adding new tasks
  - if a task priority is invalid, it will default to medium
  - made taks priority case-insensitive, essentially making HIGH and high the same value

- [#863](https://github.com/eyaltoledano/claude-task-master/pull/863) [`b530657`](https://github.com/eyaltoledano/claude-task-master/commit/b53065713c8da0ae6f18eb2655397aa975004923) Thanks [@OrenMe](https://github.com/OrenMe)! - Add support for MCP Sampling as AI provider, requires no API key, uses the client LLM provider

- [#930](https://github.com/eyaltoledano/claude-task-master/pull/930) [`98d1c97`](https://github.com/eyaltoledano/claude-task-master/commit/98d1c974361a56ddbeb772b1272986b9d3913459) Thanks [@OmarElKadri](https://github.com/OmarElKadri)! - Added Groq provider support

### Patch Changes

- [#916](https://github.com/eyaltoledano/claude-task-master/pull/916) [`6c88a4a`](https://github.com/eyaltoledano/claude-task-master/commit/6c88a4a749083e3bd2d073a9240799771774495a) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Recover from `@anthropic-ai/claude-code` JSON truncation bug that caused Task Master to crash when handling large (>8 kB) structured responses. The CLI/SDK still truncates, but Task Master now detects the error, preserves buffered text, and returns a usable response instead of throwing.

- [#916](https://github.com/eyaltoledano/claude-task-master/pull/916) [`3334e40`](https://github.com/eyaltoledano/claude-task-master/commit/3334e409ae659d5223bb136ae23fd22c5e219073) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Updating dependency ai-sdk-provider-gemini-cli to 0.0.4 to address breaking change Google made to Gemini CLI and add better 'api-key' in addition to 'gemini-api-key' AI-SDK compatibility.

- [#853](https://github.com/eyaltoledano/claude-task-master/pull/853) [`95c299d`](https://github.com/eyaltoledano/claude-task-master/commit/95c299df642bd8e6d75f8fa5110ac705bcc72edf) Thanks [@joedanz](https://github.com/joedanz)! - Unify and streamline profile system architecture for improved maintainability

## 0.19.0

### Minor Changes

- [#897](https://github.com/eyaltoledano/claude-task-master/pull/897) [`dd96f51`](https://github.com/eyaltoledano/claude-task-master/commit/dd96f51179d9901f6ae854b0c60f0bcc8c13ae0d) Thanks [@ben-vargas](https://github.com/ben-vargas)! - Adds support for gemini-cli as a provider, enabling free or subscription use through Google Accounts and paid Gemini Cloud Assist (GCA) subscriptions.

- [#884](https://github.com/eyaltoledano/claude-task-master/pull/884) [`5eafc5e`](https://github.com/eyaltoledano/claude-task-master/commit/5eafc5ea112c91326bb8abda7a78d7c2a4fa16a1) Thanks [@geoh](https://github.com/geoh)! - Added option for the AI to determine the number of tasks required based entirely on complexity

- [#872](https://github.com/eyaltoledano/claude-task-master/pull/872) [`f7fbdd6`](https://github.com/eyaltoledano/claude-task-master/commit/f7fbdd6755c4a1ee3ab2a3f435961f249fa19c15) Thanks [@geoh](https://github.com/geoh)! - Add advanced settings for Claude Code AI Provider

- [#870](https://github.com/eyaltoledano/claude-task-master/pull/870) [`6fd5e23`](https://github.com/eyaltoledano/claude-task-master/commit/6fd5e23396a7e348ea2300e67cbd0c97141c081f) Thanks [@nishedcob](https://github.com/nishedcob)! - Include additional Anthropic models running on Bedrock in what is supported

- [#510](https://github.com/eyaltoledano/claude-task-master/pull/510) [`c99df64`](https://github.com/eyaltoledano/claude-task-master/commit/c99df64f651fb40bae5d7979ee2b2428586f44d3) Thanks [@shenysun](https://github.com/shenysun)! - Add support for custom response language

### Patch Changes

- [#892](https://github.com/eyaltoledano/claude-task-master/pull/892) [`56a415e`](https://github.com/eyaltoledano/claude-task-master/commit/56a415ef795c5aa0e52e7419af8d4f4862611a8c) Thanks [@joedanz](https://github.com/joedanz)! - Ensure projectRoot is a string (potential WSL fix)

- [#856](https://github.com/eyaltoledano/claude-task-master/pull/856) [`43e0025`](https://github.com/eyaltoledano/claude-task-master/commit/43e0025f4c5870a3c56682cbb8fe0348d711953b) Thanks [@mm-parthy](https://github.com/mm-parthy)! - Fix bulk update tag corruption in tagged task lists

- [#857](https://github.com/eyaltoledano/claude-task-master/pull/857) [`598e687`](https://github.com/eyaltoledano/claude-task-master/commit/598e687067d1af44f1a9916266ae94af3e752067) Thanks [@mm-parthy](https://github.com/mm-parthy)! - Fix expand-task to use tag-specific complexity reports

  The expand-task function now correctly uses complexity reports specific to the current tag context (e.g., task-complexity-report_feature-branch.json) instead of always using the default task-complexity-report.json file. This enables proper task expansion behavior when working with multiple tag contexts.

- [#855](https://github.com/eyaltoledano/claude-task-master/pull/855) [`e4456b1`](https://github.com/eyaltoledano/claude-task-master/commit/e4456b11bc3ae46e120d244fc32c1807a8a58a57) Thanks [@joedanz](https://github.com/joedanz)! - Fix .gitignore missing trailing newline during project initialization

- [#846](https://github.com/eyaltoledano/claude-task-master/pull/846) [`59a4ec9`](https://github.com/eyaltoledano/claude-task-master/commit/59a4ec9e1a452079e5c78c00428d140f13a1c8f6) Thanks [@joedanz](https://github.com/joedanz)! - Default to Cursor profile for MCP init when no rules specified

- [#852](https://github.com/eyaltoledano/claude-task-master/pull/852) [`f38abd6`](https://github.com/eyaltoledano/claude-task-master/commit/f38abd68436ea5d093b2e22c2b8520b6e6906251) Thanks [@hrmshandy](https://github.com/hrmshandy)! - fixes a critical issue where subtask generation fails on gemini-2.5-pro unless explicitly prompted to return 'details' field as a string not an object

- [#908](https://github.com/eyaltoledano/claude-task-master/pull/908) [`24e9206`](https://github.com/eyaltoledano/claude-task-master/commit/24e9206da0d5d3f2f7819ed94fa0c9b459fc9f9b) Thanks [@joedanz](https://github.com/joedanz)! - Fix rules command to use reliable project root detection like other commands

## 0.18.0

### Minor Changes

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Can now configure baseURL of provider with `<PROVIDER>_BASE_URL`
  - For example:
    - `OPENAI_BASE_URL`

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Added comprehensive rule profile management:

  **New Profile Support**: Added comprehensive IDE profile support with eight specialized profiles: Claude Code, Cline, Codex, Cursor, Roo, Trae, VS Code, and Windsurf. Each profile is optimized for its respective IDE with appropriate mappings and configuration.
  **Initialization**: You can now specify which rule profiles to include at project initialization using `--rules <profiles>` or `-r <profiles>` (e.g., `task-master init -r cursor,roo`). Only the selected profiles and configuration are included.
  **Add/Remove Commands**: `task-master rules add <profiles>` and `task-master rules remove <profiles>` let you manage specific rule profiles and MCP config after initialization, supporting multiple profiles at once.
  **Interactive Setup**: `task-master rules setup` launches an interactive prompt to select which rule profiles to add to your project. This does **not** re-initialize your project or affect shell aliases; it only manages rules.
  **Selective Removal**: Rules removal intelligently preserves existing non-Task Master rules and files and only removes Task Master-specific rules. Profile directories are only removed when completely empty and all conditions are met (no existing rules, no other files/folders, MCP config completely removed).
  **Safety Features**: Confirmation messages clearly explain that only Task Master-specific rules and MCP configurations will be removed, while preserving existing custom rules and other files.
  **Robust Validation**: Includes comprehensive checks for array types in MCP config processing and error handling throughout the rules management system.

  This enables more flexible, rule-specific project setups with intelligent cleanup that preserves user customizations while safely managing Task Master components.
  - Resolves #338

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Make task-master more compatible with the "o" family models of OpenAI

  Now works well with:
  - o3
  - o3-mini
  - etc.

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add better support for python projects by adding `pyproject.toml` as a projectRoot marker

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - - **Git Worktree Detection:**
  - Now properly skips Git initialization when inside existing Git worktree
  - Prevents accidental nested repository creation
  - **Flag System Overhaul:**
    - `--git`/`--no-git` controls repository initialization
    - `--aliases`/`--no-aliases` consistently manages shell alias creation
    - `--git-tasks`/`--no-git-tasks` controls whether task files are stored in Git
    - `--dry-run` accurately previews all initialization behaviors
  - **GitTasks Functionality:**
    - New `--git-tasks` flag includes task files in Git (comments them out in .gitignore)
    - New `--no-git-tasks` flag excludes task files from Git (default behavior)
    - Supports both CLI and MCP interfaces with proper parameter passing

  **Implementation Details:**
  - Added explicit Git worktree detection before initialization
  - Refactored flag processing to ensure consistent behavior
  - Fixes #734

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Claude Code provider support

  Introduces a new provider that enables using Claude models (Opus and Sonnet) through the Claude Code CLI without requiring an API key.

  Key features:
  - New claude-code provider with support for opus and sonnet models
  - No API key required - uses local Claude Code CLI installation
  - Optional dependency - won't affect users who don't need Claude Code
  - Lazy loading ensures the provider only loads when requested
  - Full integration with existing Task Master commands and workflows
  - Comprehensive test coverage for reliability
  - New --claude-code flag for the models command

  Users can now configure Claude Code models with:
  task-master models --set-main sonnet --claude-code
  task-master models --set-research opus --claude-code

  The @anthropic-ai/claude-code package is optional and won't be installed unless explicitly needed.

### Patch Changes

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix expand command preserving tagged task structure and preventing data corruption
  - Enhance E2E tests with comprehensive tag-aware expand testing to verify tag corruption fix
  - Add new test section for feature-expand tag creation and testing during expand operations
  - Verify tag preservation during expand, force expand, and expand --all operations
  - Test that master tag remains intact while feature-expand tag receives subtasks correctly
  - Fix file path references to use correct .taskmaster/config.json and .taskmaster/tasks/tasks.json locations
  - All tag corruption verification tests pass successfully, confirming the expand command tag corruption bug fix works as expected

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix Cursor deeplink installation by providing copy-paste instructions for GitHub compatibility

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Call rules interactive setup during init

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Update o3 model price

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improves Amazon Bedrock support

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix issues with task creation/update where subtasks are being created like id: <parent_task>.<subtask> instead if just id: <subtask>

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fixes issue with expand CLI command "Complexity report not found"
  - Closes #735
  - Closes #728

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Store tasks in Git by default

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve provider validation system with clean constants structure
  - **Fixed "Invalid provider hint" errors**: Resolved validation failures for Azure, Vertex, and Bedrock providers
  - **Improved search UX**: Integrated search for better model discovery with real-time filtering
  - **Better organization**: Moved custom provider options to bottom of model selection with clear section separators

  This change ensures all custom providers (Azure, Vertex, Bedrock, OpenRouter, Ollama) work correctly in `task-master models --setup`

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix weird `task-master init` bug when using in certain environments

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Rename Roo Code Boomerang role to Orchestrator

- [#840](https://github.com/eyaltoledano/claude-task-master/pull/840) [`b40139c`](https://github.com/eyaltoledano/claude-task-master/commit/b40139ca0517fd76aea4f41d0ed4c10e658a5d2b) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve mcp keys check in cursor

## 0.18.0-rc.0

### Minor Changes

- [#830](https://github.com/eyaltoledano/claude-task-master/pull/830) [`e9d1bc2`](https://github.com/eyaltoledano/claude-task-master/commit/e9d1bc2385521c08374a85eba7899e878a51066c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Can now configure baseURL of provider with `<PROVIDER>_BASE_URL`
  - For example:
    - `OPENAI_BASE_URL`

- [#460](https://github.com/eyaltoledano/claude-task-master/pull/460) [`a09a2d0`](https://github.com/eyaltoledano/claude-task-master/commit/a09a2d0967a10276623e3f3ead3ed577c15ce62f) Thanks [@joedanz](https://github.com/joedanz)! - Added comprehensive rule profile management:

  **New Profile Support**: Added comprehensive IDE profile support with eight specialized profiles: Claude Code, Cline, Codex, Cursor, Roo, Trae, VS Code, and Windsurf. Each profile is optimized for its respective IDE with appropriate mappings and configuration.
  **Initialization**: You can now specify which rule profiles to include at project initialization using `--rules <profiles>` or `-r <profiles>` (e.g., `task-master init -r cursor,roo`). Only the selected profiles and configuration are included.
  **Add/Remove Commands**: `task-master rules add <profiles>` and `task-master rules remove <profiles>` let you manage specific rule profiles and MCP config after initialization, supporting multiple profiles at once.
  **Interactive Setup**: `task-master rules setup` launches an interactive prompt to select which rule profiles to add to your project. This does **not** re-initialize your project or affect shell aliases; it only manages rules.
  **Selective Removal**: Rules removal intelligently preserves existing non-Task Master rules and files and only removes Task Master-specific rules. Profile directories are only removed when completely empty and all conditions are met (no existing rules, no other files/folders, MCP config completely removed).
  **Safety Features**: Confirmation messages clearly explain that only Task Master-specific rules and MCP configurations will be removed, while preserving existing custom rules and other files.
  **Robust Validation**: Includes comprehensive checks for array types in MCP config processing and error handling throughout the rules management system.

  This enables more flexible, rule-specific project setups with intelligent cleanup that preserves user customizations while safely managing Task Master components.
  - Resolves #338

- [#804](https://github.com/eyaltoledano/claude-task-master/pull/804) [`1b8c320`](https://github.com/eyaltoledano/claude-task-master/commit/1b8c320c570473082f1eb4bf9628bff66e799092) Thanks [@ejones40](https://github.com/ejones40)! - Add better support for python projects by adding `pyproject.toml` as a projectRoot marker

- [#743](https://github.com/eyaltoledano/claude-task-master/pull/743) [`a2a3229`](https://github.com/eyaltoledano/claude-task-master/commit/a2a3229fd01e24a5838f11a3938a77250101e184) Thanks [@joedanz](https://github.com/joedanz)! - - **Git Worktree Detection:**
  - Now properly skips Git initialization when inside existing Git worktree
  - Prevents accidental nested repository creation
  - **Flag System Overhaul:**
    - `--git`/`--no-git` controls repository initialization
    - `--aliases`/`--no-aliases` consistently manages shell alias creation
    - `--git-tasks`/`--no-git-tasks` controls whether task files are stored in Git
    - `--dry-run` accurately previews all initialization behaviors
  - **GitTasks Functionality:**
    - New `--git-tasks` flag includes task files in Git (comments them out in .gitignore)
    - New `--no-git-tasks` flag excludes task files from Git (default behavior)
    - Supports both CLI and MCP interfaces with proper parameter passing

  **Implementation Details:**
  - Added explicit Git worktree detection before initialization
  - Refactored flag processing to ensure consistent behavior
  - Fixes #734

- [#829](https://github.com/eyaltoledano/claude-task-master/pull/829) [`4b0c9d9`](https://github.com/eyaltoledano/claude-task-master/commit/4b0c9d9af62d00359fca3f43283cf33223d410bc) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Claude Code provider support

  Introduces a new provider that enables using Claude models (Opus and Sonnet) through the Claude Code CLI without requiring an API key.

  Key features:
  - New claude-code provider with support for opus and sonnet models
  - No API key required - uses local Claude Code CLI installation
  - Optional dependency - won't affect users who don't need Claude Code
  - Lazy loading ensures the provider only loads when requested
  - Full integration with existing Task Master commands and workflows
  - Comprehensive test coverage for reliability
  - New --claude-code flag for the models command

  Users can now configure Claude Code models with:
  task-master models --set-main sonnet --claude-code
  task-master models --set-research opus --claude-code

  The @anthropic-ai/claude-code package is optional and won't be installed unless explicitly needed.

### Patch Changes

- [#827](https://github.com/eyaltoledano/claude-task-master/pull/827) [`5da5b59`](https://github.com/eyaltoledano/claude-task-master/commit/5da5b59bdeeb634dcb3adc7a9bc0fc37e004fa0c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix expand command preserving tagged task structure and preventing data corruption
  - Enhance E2E tests with comprehensive tag-aware expand testing to verify tag corruption fix
  - Add new test section for feature-expand tag creation and testing during expand operations
  - Verify tag preservation during expand, force expand, and expand --all operations
  - Test that master tag remains intact while feature-expand tag receives subtasks correctly
  - Fix file path references to use correct .taskmaster/config.json and .taskmaster/tasks/tasks.json locations
  - All tag corruption verification tests pass successfully, confirming the expand command tag corruption bug fix works as expected

- [#833](https://github.com/eyaltoledano/claude-task-master/pull/833) [`cf2c066`](https://github.com/eyaltoledano/claude-task-master/commit/cf2c06697a0b5b952fb6ca4b3c923e9892604d08) Thanks [@joedanz](https://github.com/joedanz)! - Call rules interactive setup during init

- [#826](https://github.com/eyaltoledano/claude-task-master/pull/826) [`7811227`](https://github.com/eyaltoledano/claude-task-master/commit/78112277b3caa4539e6e29805341a944799fb0e7) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improves Amazon Bedrock support

- [#834](https://github.com/eyaltoledano/claude-task-master/pull/834) [`6483537`](https://github.com/eyaltoledano/claude-task-master/commit/648353794eb60d11ffceda87370a321ad310fbd7) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix issues with task creation/update where subtasks are being created like id: <parent_task>.<subtask> instead if just id: <subtask>

- [#835](https://github.com/eyaltoledano/claude-task-master/pull/835) [`727f1ec`](https://github.com/eyaltoledano/claude-task-master/commit/727f1ec4ebcbdd82547784c4c113b666af7e122e) Thanks [@joedanz](https://github.com/joedanz)! - Store tasks in Git by default

- [#822](https://github.com/eyaltoledano/claude-task-master/pull/822) [`1bd6d4f`](https://github.com/eyaltoledano/claude-task-master/commit/1bd6d4f2468070690e152e6e63e15a57bc550d90) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve provider validation system with clean constants structure
  - **Fixed "Invalid provider hint" errors**: Resolved validation failures for Azure, Vertex, and Bedrock providers
  - **Improved search UX**: Integrated search for better model discovery with real-time filtering
  - **Better organization**: Moved custom provider options to bottom of model selection with clear section separators

  This change ensures all custom providers (Azure, Vertex, Bedrock, OpenRouter, Ollama) work correctly in `task-master models --setup`

- [#633](https://github.com/eyaltoledano/claude-task-master/pull/633) [`3a2325a`](https://github.com/eyaltoledano/claude-task-master/commit/3a2325a963fed82377ab52546eedcbfebf507a7e) Thanks [@nmarley](https://github.com/nmarley)! - Fix weird `task-master init` bug when using in certain environments

- [#831](https://github.com/eyaltoledano/claude-task-master/pull/831) [`b592dff`](https://github.com/eyaltoledano/claude-task-master/commit/b592dff8bc5c5d7966843fceaa0adf4570934336) Thanks [@joedanz](https://github.com/joedanz)! - Rename Roo Code Boomerang role to Orchestrator

- [#830](https://github.com/eyaltoledano/claude-task-master/pull/830) [`e9d1bc2`](https://github.com/eyaltoledano/claude-task-master/commit/e9d1bc2385521c08374a85eba7899e878a51066c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve mcp keys check in cursor

## 0.17.1

### Patch Changes

- [#789](https://github.com/eyaltoledano/claude-task-master/pull/789) [`8cde6c2`](https://github.com/eyaltoledano/claude-task-master/commit/8cde6c27087f401d085fe267091ae75334309d96) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix contextGatherer bug when adding a task `Cannot read properties of undefined (reading 'forEach')`

## 0.18.0-rc.0

### Minor Changes

- [#830](https://github.com/eyaltoledano/claude-task-master/pull/830) [`e9d1bc2`](https://github.com/eyaltoledano/claude-task-master/commit/e9d1bc2385521c08374a85eba7899e878a51066c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Can now configure baseURL of provider with `<PROVIDER>_BASE_URL`
  - For example:
    - `OPENAI_BASE_URL`

- [#460](https://github.com/eyaltoledano/claude-task-master/pull/460) [`a09a2d0`](https://github.com/eyaltoledano/claude-task-master/commit/a09a2d0967a10276623e3f3ead3ed577c15ce62f) Thanks [@joedanz](https://github.com/joedanz)! - Added comprehensive rule profile management:

  **New Profile Support**: Added comprehensive IDE profile support with eight specialized profiles: Claude Code, Cline, Codex, Cursor, Roo, Trae, VS Code, and Windsurf. Each profile is optimized for its respective IDE with appropriate mappings and configuration.
  **Initialization**: You can now specify which rule profiles to include at project initialization using `--rules <profiles>` or `-r <profiles>` (e.g., `task-master init -r cursor,roo`). Only the selected profiles and configuration are included.
  **Add/Remove Commands**: `task-master rules add <profiles>` and `task-master rules remove <profiles>` let you manage specific rule profiles and MCP config after initialization, supporting multiple profiles at once.
  **Interactive Setup**: `task-master rules setup` launches an interactive prompt to select which rule profiles to add to your project. This does **not** re-initialize your project or affect shell aliases; it only manages rules.
  **Selective Removal**: Rules removal intelligently preserves existing non-Task Master rules and files and only removes Task Master-specific rules. Profile directories are only removed when completely empty and all conditions are met (no existing rules, no other files/folders, MCP config completely removed).
  **Safety Features**: Confirmation messages clearly explain that only Task Master-specific rules and MCP configurations will be removed, while preserving existing custom rules and other files.
  **Robust Validation**: Includes comprehensive checks for array types in MCP config processing and error handling throughout the rules management system.

  This enables more flexible, rule-specific project setups with intelligent cleanup that preserves user customizations while safely managing Task Master components.
  - Resolves #338

- [#804](https://github.com/eyaltoledano/claude-task-master/pull/804) [`1b8c320`](https://github.com/eyaltoledano/claude-task-master/commit/1b8c320c570473082f1eb4bf9628bff66e799092) Thanks [@ejones40](https://github.com/ejones40)! - Add better support for python projects by adding `pyproject.toml` as a projectRoot marker

- [#743](https://github.com/eyaltoledano/claude-task-master/pull/743) [`a2a3229`](https://github.com/eyaltoledano/claude-task-master/commit/a2a3229fd01e24a5838f11a3938a77250101e184) Thanks [@joedanz](https://github.com/joedanz)! - - **Git Worktree Detection:**
  - Now properly skips Git initialization when inside existing Git worktree
  - Prevents accidental nested repository creation
  - **Flag System Overhaul:**
    - `--git`/`--no-git` controls repository initialization
    - `--aliases`/`--no-aliases` consistently manages shell alias creation
    - `--git-tasks`/`--no-git-tasks` controls whether task files are stored in Git
    - `--dry-run` accurately previews all initialization behaviors
  - **GitTasks Functionality:**
    - New `--git-tasks` flag includes task files in Git (comments them out in .gitignore)
    - New `--no-git-tasks` flag excludes task files from Git (default behavior)
    - Supports both CLI and MCP interfaces with proper parameter passing

  **Implementation Details:**
  - Added explicit Git worktree detection before initialization
  - Refactored flag processing to ensure consistent behavior
  - Fixes #734

- [#829](https://github.com/eyaltoledano/claude-task-master/pull/829) [`4b0c9d9`](https://github.com/eyaltoledano/claude-task-master/commit/4b0c9d9af62d00359fca3f43283cf33223d410bc) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Claude Code provider support

  Introduces a new provider that enables using Claude models (Opus and Sonnet) through the Claude Code CLI without requiring an API key.

  Key features:
  - New claude-code provider with support for opus and sonnet models
  - No API key required - uses local Claude Code CLI installation
  - Optional dependency - won't affect users who don't need Claude Code
  - Lazy loading ensures the provider only loads when requested
  - Full integration with existing Task Master commands and workflows
  - Comprehensive test coverage for reliability
  - New --claude-code flag for the models command

  Users can now configure Claude Code models with:
  task-master models --set-main sonnet --claude-code
  task-master models --set-research opus --claude-code

  The @anthropic-ai/claude-code package is optional and won't be installed unless explicitly needed.

### Patch Changes

- [#827](https://github.com/eyaltoledano/claude-task-master/pull/827) [`5da5b59`](https://github.com/eyaltoledano/claude-task-master/commit/5da5b59bdeeb634dcb3adc7a9bc0fc37e004fa0c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix expand command preserving tagged task structure and preventing data corruption
  - Enhance E2E tests with comprehensive tag-aware expand testing to verify tag corruption fix
  - Add new test section for feature-expand tag creation and testing during expand operations
  - Verify tag preservation during expand, force expand, and expand --all operations
  - Test that master tag remains intact while feature-expand tag receives subtasks correctly
  - Fix file path references to use correct .taskmaster/config.json and .taskmaster/tasks/tasks.json locations
  - All tag corruption verification tests pass successfully, confirming the expand command tag corruption bug fix works as expected

- [#833](https://github.com/eyaltoledano/claude-task-master/pull/833) [`cf2c066`](https://github.com/eyaltoledano/claude-task-master/commit/cf2c06697a0b5b952fb6ca4b3c923e9892604d08) Thanks [@joedanz](https://github.com/joedanz)! - Call rules interactive setup during init

- [#826](https://github.com/eyaltoledano/claude-task-master/pull/826) [`7811227`](https://github.com/eyaltoledano/claude-task-master/commit/78112277b3caa4539e6e29805341a944799fb0e7) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improves Amazon Bedrock support

- [#834](https://github.com/eyaltoledano/claude-task-master/pull/834) [`6483537`](https://github.com/eyaltoledano/claude-task-master/commit/648353794eb60d11ffceda87370a321ad310fbd7) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix issues with task creation/update where subtasks are being created like id: <parent_task>.<subtask> instead if just id: <subtask>

- [#835](https://github.com/eyaltoledano/claude-task-master/pull/835) [`727f1ec`](https://github.com/eyaltoledano/claude-task-master/commit/727f1ec4ebcbdd82547784c4c113b666af7e122e) Thanks [@joedanz](https://github.com/joedanz)! - Store tasks in Git by default

- [#822](https://github.com/eyaltoledano/claude-task-master/pull/822) [`1bd6d4f`](https://github.com/eyaltoledano/claude-task-master/commit/1bd6d4f2468070690e152e6e63e15a57bc550d90) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve provider validation system with clean constants structure
  - **Fixed "Invalid provider hint" errors**: Resolved validation failures for Azure, Vertex, and Bedrock providers
  - **Improved search UX**: Integrated search for better model discovery with real-time filtering
  - **Better organization**: Moved custom provider options to bottom of model selection with clear section separators

  This change ensures all custom providers (Azure, Vertex, Bedrock, OpenRouter, Ollama) work correctly in `task-master models --setup`

- [#633](https://github.com/eyaltoledano/claude-task-master/pull/633) [`3a2325a`](https://github.com/eyaltoledano/claude-task-master/commit/3a2325a963fed82377ab52546eedcbfebf507a7e) Thanks [@nmarley](https://github.com/nmarley)! - Fix weird `task-master init` bug when using in certain environments

- [#831](https://github.com/eyaltoledano/claude-task-master/pull/831) [`b592dff`](https://github.com/eyaltoledano/claude-task-master/commit/b592dff8bc5c5d7966843fceaa0adf4570934336) Thanks [@joedanz](https://github.com/joedanz)! - Rename Roo Code Boomerang role to Orchestrator

- [#830](https://github.com/eyaltoledano/claude-task-master/pull/830) [`e9d1bc2`](https://github.com/eyaltoledano/claude-task-master/commit/e9d1bc2385521c08374a85eba7899e878a51066c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Improve mcp keys check in cursor

## 0.17.1

### Patch Changes

- [#789](https://github.com/eyaltoledano/claude-task-master/pull/789) [`8cde6c2`](https://github.com/eyaltoledano/claude-task-master/commit/8cde6c27087f401d085fe267091ae75334309d96) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix contextGatherer bug when adding a task `Cannot read properties of undefined (reading 'forEach')`

## 0.17.0

### Minor Changes

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add comprehensive AI-powered research command with intelligent context gathering and interactive follow-ups.

  The new `research` command provides AI-powered research capabilities that automatically gather relevant project context to answer your questions. The command intelligently selects context from multiple sources and supports interactive follow-up questions in CLI mode.

  **Key Features:**
  - **Intelligent Task Discovery**: Automatically finds relevant tasks and subtasks using fuzzy search based on your query keywords, supplementing any explicitly provided task IDs
  - **Multi-Source Context**: Gathers context from tasks, files, project structure, and custom text to provide comprehensive answers
  - **Interactive Follow-ups**: CLI users can ask follow-up questions that build on the conversation history while allowing fresh context discovery for each question
  - **Flexible Detail Levels**: Choose from low (concise), medium (balanced), or high (comprehensive) response detail levels
  - **Token Transparency**: Displays detailed token breakdown showing context size, sources, and estimated costs
  - **Enhanced Display**: Syntax-highlighted code blocks and structured output with clear visual separation

  **Usage Examples:**

  ```bash
  # Basic research with auto-discovered context
  task-master research "How should I implement user authentication?"

  # Research with specific task context
  task-master research "What's the best approach for this?" --id=15,23.2

  # Research with file context and project tree
  task-master research "How does the current auth system work?" --files=src/auth.js,config/auth.json --tree

  # Research with custom context and low detail
  task-master research "Quick implementation steps?" --context="Using JWT tokens" --detail=low
  ```

  **Context Sources:**
  - **Tasks**: Automatically discovers relevant tasks/subtasks via fuzzy search, plus any explicitly specified via `--id`
  - **Files**: Include specific files via `--files` for code-aware responses
  - **Project Tree**: Add `--tree` to include project structure overview
  - **Custom Context**: Provide additional context via `--context` for domain-specific information

  **Interactive Features (CLI only):**
  - Follow-up questions that maintain conversation history
  - Fresh fuzzy search for each follow-up to discover newly relevant tasks
  - Cumulative context building across the conversation
  - Clean visual separation between exchanges
  - **Save to Tasks**: Save entire research conversations (including follow-ups) directly to task or subtask details with timestamps
  - **Clean Menu Interface**: Streamlined inquirer-based menu for follow-up actions without redundant UI elements

  **Save Functionality:**

  The research command now supports saving complete conversation threads to tasks or subtasks:
  - Save research results and follow-up conversations to any task (e.g., "15") or subtask (e.g., "15.2")
  - Automatic timestamping and formatting of conversation history
  - Validation of task/subtask existence before saving
  - Appends to existing task details without overwriting content
  - Supports both CLI interactive mode and MCP programmatic access via `--save-to` flag

  **Enhanced CLI Options:**

  ```bash
  # Auto-save research results to a task
  task-master research "Implementation approach?" --save-to=15

  # Combine auto-save with context gathering
  task-master research "How to optimize this?" --id=23 --save-to=23.1
  ```

  **MCP Integration:**
  - `saveTo` parameter for automatic saving to specified task/subtask ID
  - Structured response format with telemetry data
  - Silent operation mode for programmatic usage
  - Full feature parity with CLI except interactive follow-ups

  The research command integrates with the existing AI service layer and supports all configured AI providers. Both CLI and MCP interfaces provide comprehensive research capabilities with intelligent context gathering and flexible output options.

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Enhance update-task with --append flag for timestamped task updates

  Adds the `--append` flag to `update-task` command, enabling it to behave like `update-subtask` with timestamped information appending. This provides more flexible task updating options:

  **CLI Enhancement:**
  - `task-master update-task --id=5 --prompt="New info"` - Full task update (existing behavior)
  - `task-master update-task --id=5 --append --prompt="Progress update"` - Append timestamped info to task details

  **Full MCP Integration:**
  - MCP tool `update_task` now supports `append` parameter
  - Seamless integration with Cursor and other MCP clients
  - Consistent behavior between CLI and MCP interfaces

  Instead of requiring separate subtask creation for progress tracking, you can now append timestamped information directly to parent tasks while preserving the option for comprehensive task updates.

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add --tag flag support to core commands for multi-context task management. Commands like parse-prd, analyze-complexity, and others now support targeting specific task lists, enabling rapid prototyping and parallel development workflows.

  Key features:
  - parse-prd --tag=feature-name: Parse PRDs into separate task contexts on the fly
  - analyze-complexity --tag=branch: Generate tag-specific complexity reports
  - All task operations can target specific contexts while preserving other lists
  - Non-existent tags are created automatically for seamless workflow

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Introduces Tagged Lists: AI Multi-Context Task Management System

  This major feature release introduces Tagged Lists, a comprehensive system that transforms Taskmaster into a multi-context task management powerhouse. You can now organize tasks into completely isolated contexts, enabling parallel (agentic) development workflows, team collaboration, and project experimentation without conflicts.

  **🏷️ Tagged Task Lists Architecture:**

  The new tagged system fundamentally improves how tasks are organized:
  - **Legacy Format**: `{ "tasks": [...] }`
  - **New Tagged Format**: `{ "master": { "tasks": [...], "metadata": {...} }, "feature-xyz": { "tasks": [...], "metadata": {...} } }`
  - **Automatic Migration**: Existing projects will seamlessly migrate to tagged format with zero user intervention
  - **State Management**: New `.taskmaster/state.json` tracks current tag, last switched time, migration status and more.
  - **Configuration Integration**: Enhanced `.taskmaster/config.json` with tag-specific settings and defaults.

  By default, your existing task list will be migrated to the `master` tag.

  **🚀 Complete Tag Management Suite:**

  **Core Tag Commands:**
  - `task-master tags [--show-metadata]` - List all tags with task counts, completion stats, and metadata
  - `task-master add-tag <name> [options]` - Create new tag contexts with optional task copying
  - `task-master delete-tag <name> [--yes]` - Delete tags (and attached tasks) with double confirmation protection
  - `task-master use-tag <name>` - Switch contexts and immediately see next available task
  - `task-master rename-tag <old> <new>` - Rename tags with automatic current tag reference updates
  - `task-master copy-tag <source> <target> [options]` - Duplicate tag contexts for experimentation

  **🤖 Full MCP Integration for Tag Management:**

  Task Master's multi-context capabilities are now fully exposed through the MCP server, enabling powerful agentic workflows:
  - **`list_tags`**: List all available tag contexts.
  - **`add_tag`**: Programmatically create new tags.
  - **`delete_tag`**: Remove tag contexts.
  - **`use_tag`**: Switch the agent's active task context.
  - **`rename_tag`**: Rename existing tags.
  - **`copy_tag`**: Duplicate entire task contexts for experimentation.

  **Tag Creation Options:**
  - `--copy-from-current` - Copy tasks from currently active tag
  - `--copy-from=<tag>` - Copy tasks from specific tag
  - `--from-branch` - Creates a new tag using the active git branch name (for `add-tag` only)
  - `--description="<text>"` - Add custom tag descriptions
  - Empty tag creation for fresh contexts

  **🎯 Universal --tag Flag Support:**

  Every task operation now supports tag-specific execution:
  - `task-master list --tag=feature-branch` - View tasks in specific context
  - `task-master add-task --tag=experiment --prompt="..."` - Create tasks in specific tag
  - `task-master parse-prd document.txt --tag=v2-redesign` - Parse PRDs into dedicated contexts
  - `task-master analyze-complexity --tag=performance-work` - Generate tag-specific reports
  - `task-master set-status --tag=hotfix --id=5 --status=done` - Update tasks in specific contexts
  - `task-master expand --tag=research --id=3` - Break down tasks within tag contexts

  This way you or your agent can store out of context tasks into the appropriate tags for later, allowing you to maintain a groomed and scoped master list. Focus on value, not chores.

  **📊 Enhanced Workflow Features:**

  **Smart Context Switching:**
  - `use-tag` command shows immediate next task after switching
  - Automatic tag creation when targeting non-existent tags
  - Current tag persistence across terminal sessions
  - Branch-tag mapping for future Git integration

  **Intelligent File Management:**
  - Tag-specific complexity reports: `task-complexity-report_tagname.json`
  - Master tag uses default filenames: `task-complexity-report.json`
  - Automatic file isolation prevents cross-tag contamination

  **Advanced Confirmation Logic:**
  - Commands only prompt when target tag has existing tasks
  - Empty tags allow immediate operations without confirmation
  - Smart append vs overwrite detection

  **🔄 Seamless Migration & Compatibility:**

  **Zero-Disruption Migration:**
  - Existing `tasks.json` files automatically migrate on first command
  - Master tag receives proper metadata (creation date, description)
  - Migration notice shown once with helpful explanation
  - All existing commands work identically to before

  **State Management:**
  - `.taskmaster/state.json` tracks current tag and migration status
  - Automatic state creation and maintenance
  - Branch-tag mapping foundation for Git integration
  - Migration notice tracking to avoid repeated notifications
  - Grounds for future context additions

  **Backward Compatibility:**
  - All existing workflows continue unchanged
  - Legacy commands work exactly as before
  - Gradual adoption - users can ignore tags entirely if desired
  - No breaking changes to existing tasks or file formats

  **💡 Real-World Use Cases:**

  **Team Collaboration:**
  - `task-master add-tag alice --copy-from-current` - Create teammate-specific contexts
  - `task-master add-tag bob --copy-from=master` - Onboard new team members
  - `task-master use-tag alice` - Switch to teammate's work context

  **Feature Development:**
  - `task-master parse-prd feature-spec.txt --tag=user-auth` - Dedicated feature planning
  - `task-master add-tag experiment --copy-from=user-auth` - Safe experimentation
  - `task-master analyze-complexity --tag=user-auth` - Feature-specific analysis

  **Release Management:**
  - `task-master add-tag v2.0 --description="Next major release"` - Version-specific planning
  - `task-master copy-tag master v2.1` - Release branch preparation
  - `task-master use-tag hotfix` - Emergency fix context

  **Project Phases:**
  - `task-master add-tag research --description="Discovery phase"` - Research tasks
  - `task-master add-tag implementation --copy-from=research` - Development phase
  - `task-master add-tag testing --copy-from=implementation` - QA phase

  **🛠️ Technical Implementation:**

  **Data Structure:**
  - Tagged format with complete isolation between contexts
  - Rich metadata per tag (creation date, description, update tracking)
  - Automatic metadata enhancement for existing tags
  - Clean separation of tag data and internal state

  **Performance Optimizations:**
  - Dynamic task counting without stored counters
  - Efficient tag resolution and caching
  - Minimal file I/O with smart data loading
  - Responsive table layouts adapting to terminal width

  **Error Handling:**
  - Comprehensive validation for tag names (alphanumeric, hyphens, underscores)
  - Reserved name protection (master, main, default)
  - Graceful handling of missing tags and corrupted data
  - Detailed error messages with suggested corrections

  This release establishes the foundation for advanced multi-context workflows while maintaining the simplicity and power that makes Task Master effective for individual developers.

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Research Save-to-File Feature & Critical MCP Tag Corruption Fix

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

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - No longer automatically creates individual task files as they are not used by the applicatoin. You can still generate them anytime using the `generate` command.

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Enhanced get-task/show command to support comma-separated task IDs for efficient batch operations

  **New Features:**
  - **Multiple Task Retrieval**: Pass comma-separated IDs to get/show multiple tasks at once (e.g., `task-master show 1,3,5` or MCP `get_task` with `id: "1,3,5"`)
  - **Smart Display Logic**: Single ID shows detailed view, multiple IDs show compact summary table with interactive options
  - **Batch Action Menu**: Interactive menu for multiple tasks with copy-paste ready commands for common operations (mark as done/in-progress, expand all, view dependencies, etc.)
  - **MCP Array Response**: MCP tool returns structured array of task objects for efficient AI agent context gathering

  **Benefits:**
  - **Faster Context Gathering**: AI agents can collect multiple tasks/subtasks in one call instead of iterating
  - **Improved Workflow**: Interactive batch operations reduce repetitive command execution
  - **Better UX**: Responsive layout adapts to terminal width, maintains consistency with existing UI patterns
  - **API Efficiency**: RESTful array responses in MCP format enable more sophisticated integrations

  This enhancement maintains full backward compatibility while significantly improving efficiency for both human users and AI agents working with multiple tasks.

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds support for filtering tasks by multiple statuses at once using comma-separated statuses.

  Example: `cancelled,deferred`

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds tag to CLI and MCP outputs/responses so you know which tag you are performing operations on.

### Patch Changes

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`5ec1f61`](https://github.com/eyaltoledano/claude-task-master/commit/5ec1f61c13f468648b7fdc8fa112e95aec25f76d) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fix Cursor deeplink installation by providing copy-paste instructions for GitHub compatibility

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fix critical bugs in task move functionality:
  - **Fixed moving tasks to become subtasks of empty parents**: When moving a task to become a subtask of a parent that had no existing subtasks (e.g., task 89 → task 98.1), the operation would fail with validation errors.
  - **Fixed moving subtasks between parents**: Subtasks can now be properly moved between different parent tasks, including to parents that previously had no subtasks.
  - **Improved comma-separated batch moves**: Multiple tasks can now be moved simultaneously using comma-separated IDs (e.g., "88,90" → "92,93") with proper error handling and atomic operations.

  These fixes enables proper task hierarchy reorganization for corner cases that were previously broken.

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`d76bea4`](https://github.com/eyaltoledano/claude-task-master/commit/d76bea49b381c523183f39e33c2a4269371576ed) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Update o3 model price

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`0849c0c`](https://github.com/eyaltoledano/claude-task-master/commit/0849c0c2cedb16ac44ba5cc2d109625a9b4efd67) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fixes issue with expand CLI command "Complexity report not found"
  - Closes #735
  - Closes #728

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fix issue with generate command which was creating tasks in the legacy tasks location.

      - No longer creates individual task files automatically. You can still use `generate` if you need to create our update your task files.

- [#779](https://github.com/eyaltoledano/claude-task-master/pull/779) [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Improves dependency management when moving tasks by updating subtask dependencies that reference sibling subtasks by their old parent-based ID

- Updated dependencies [[`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`5ec1f61`](https://github.com/eyaltoledano/claude-task-master/commit/5ec1f61c13f468648b7fdc8fa112e95aec25f76d), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`d76bea4`](https://github.com/eyaltoledano/claude-task-master/commit/d76bea49b381c523183f39e33c2a4269371576ed), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`0849c0c`](https://github.com/eyaltoledano/claude-task-master/commit/0849c0c2cedb16ac44ba5cc2d109625a9b4efd67), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f), [`c0b3f43`](https://github.com/eyaltoledano/claude-task-master/commit/c0b3f432a60891550b00acb113dc877bd432995f)]:
  - task-master-ai@0.17.0

## 0.16.2

### Patch Changes

- [#695](https://github.com/eyaltoledano/claude-task-master/pull/695) [`1ece6f1`](https://github.com/eyaltoledano/claude-task-master/commit/1ece6f19048df6ae2a0b25cbfb84d2c0f430642c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - improve findTasks algorithm for resolving tasks path

- [#695](https://github.com/eyaltoledano/claude-task-master/pull/695) [`ee0be04`](https://github.com/eyaltoledano/claude-task-master/commit/ee0be04302cc602246de5cd296291db69bc8b300) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix update tool on MCP giving `No valid tasks found`

- [#699](https://github.com/eyaltoledano/claude-task-master/pull/699) [`27edbd8`](https://github.com/eyaltoledano/claude-task-master/commit/27edbd8f3fe5e2ac200b80e7f27f4c0e74a074d6) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Enhanced add-task fuzzy search intelligence and improved user experience

  **Smarter Task Discovery:**
  - Remove hardcoded category system that always matched "Task management"
  - Eliminate arbitrary limits on fuzzy search results (5→25 high relevance, 3→10 medium relevance, 8→20 detailed tasks)
  - Improve semantic weighting in Fuse.js search (details=3, description=2, title=1.5) for better relevance
  - Generate context-driven task recommendations based on true semantic similarity

  **Enhanced Terminal Experience:**
  - Fix duplicate banner display issue that was "eating" terminal history (closes #553)
  - Remove console.clear() and redundant displayBanner() calls from UI functions
  - Preserve command history for better development workflow
  - Streamline banner display across all commands (list, next, show, set-status, clear-subtasks, dependency commands)

  **Visual Improvements:**
  - Replace emoji complexity indicators with clean filled circle characters (●) for professional appearance
  - Improve consistency and readability of task complexity display

  **AI Provider Compatibility:**
  - Change generateObject mode from 'tool' to 'auto' for better cross-provider compatibility
  - Add qwen3-235n-a22b:free model support (closes #687)
  - Add smart warnings for free OpenRouter models with limitations (rate limits, restricted context, no tool_use)

  **Technical Improvements:**
  - Enhanced context generation in add-task to rely on semantic similarity rather than rigid pattern matching
  - Improved dependency analysis and common pattern detection
  - Better handling of task relationships and relevance scoring
  - More intelligent task suggestion algorithms

  The add-task system now provides truly relevant task context based on semantic understanding rather than arbitrary categories and limits, while maintaining a cleaner and more professional terminal experience.

- [#655](https://github.com/eyaltoledano/claude-task-master/pull/655) [`edaa5fe`](https://github.com/eyaltoledano/claude-task-master/commit/edaa5fe0d56e0e4e7c4370670a7a388eebd922ac) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix double .taskmaster directory paths in file resolution utilities
  - Closes #636

- [#671](https://github.com/eyaltoledano/claude-task-master/pull/671) [`86ea6d1`](https://github.com/eyaltoledano/claude-task-master/commit/86ea6d1dbc03eeb39f524f565b50b7017b1d2c9c) Thanks [@joedanz](https://github.com/joedanz)! - Add one-click MCP server installation for Cursor

- [#699](https://github.com/eyaltoledano/claude-task-master/pull/699) [`2e55757`](https://github.com/eyaltoledano/claude-task-master/commit/2e55757b2698ba20b78f09ec0286951297510b8e) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add sync-readme command for a task export to GitHub README

  Introduces a new `sync-readme` command that exports your task list to your project's README.md file.

  **Features:**
  - **Flexible filtering**: Supports `--status` filtering (e.g., pending, done) and `--with-subtasks` flag
  - **Smart content management**: Automatically replaces existing exports or appends to new READMEs
  - **Metadata display**: Shows export timestamp, subtask inclusion status, and filter settings

  **Usage:**
  - `task-master sync-readme` - Export tasks without subtasks
  - `task-master sync-readme --with-subtasks` - Include subtasks in export
  - `task-master sync-readme --status=pending` - Only export pending tasks
  - `task-master sync-readme --status=done --with-subtasks` - Export completed tasks with subtasks

  Perfect for showcasing project progress on GitHub. Experimental. Open to feedback.

## 0.16.2

### Patch Changes

- [#695](https://github.com/eyaltoledano/claude-task-master/pull/695) [`1ece6f1`](https://github.com/eyaltoledano/claude-task-master/commit/1ece6f19048df6ae2a0b25cbfb84d2c0f430642c) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - improve findTasks algorithm for resolving tasks path

- [#695](https://github.com/eyaltoledano/claude-task-master/pull/695) [`ee0be04`](https://github.com/eyaltoledano/claude-task-master/commit/ee0be04302cc602246de5cd296291db69bc8b300) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix update tool on MCP giving `No valid tasks found`

- [#699](https://github.com/eyaltoledano/claude-task-master/pull/699) [`27edbd8`](https://github.com/eyaltoledano/claude-task-master/commit/27edbd8f3fe5e2ac200b80e7f27f4c0e74a074d6) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Enhanced add-task fuzzy search intelligence and improved user experience

  **Smarter Task Discovery:**
  - Remove hardcoded category system that always matched "Task management"
  - Eliminate arbitrary limits on fuzzy search results (5→25 high relevance, 3→10 medium relevance, 8→20 detailed tasks)
  - Improve semantic weighting in Fuse.js search (details=3, description=2, title=1.5) for better relevance
  - Generate context-driven task recommendations based on true semantic similarity

  **Enhanced Terminal Experience:**
  - Fix duplicate banner display issue that was "eating" terminal history (closes #553)
  - Remove console.clear() and redundant displayBanner() calls from UI functions
  - Preserve command history for better development workflow
  - Streamline banner display across all commands (list, next, show, set-status, clear-subtasks, dependency commands)

  **Visual Improvements:**
  - Replace emoji complexity indicators with clean filled circle characters (●) for professional appearance
  - Improve consistency and readability of task complexity display

  **AI Provider Compatibility:**
  - Change generateObject mode from 'tool' to 'auto' for better cross-provider compatibility
  - Add qwen3-235n-a22b:free model support (closes #687)
  - Add smart warnings for free OpenRouter models with limitations (rate limits, restricted context, no tool_use)

  **Technical Improvements:**
  - Enhanced context generation in add-task to rely on semantic similarity rather than rigid pattern matching
  - Improved dependency analysis and common pattern detection
  - Better handling of task relationships and relevance scoring
  - More intelligent task suggestion algorithms

  The add-task system now provides truly relevant task context based on semantic understanding rather than arbitrary categories and limits, while maintaining a cleaner and more professional terminal experience.

- [#655](https://github.com/eyaltoledano/claude-task-master/pull/655) [`edaa5fe`](https://github.com/eyaltoledano/claude-task-master/commit/edaa5fe0d56e0e4e7c4370670a7a388eebd922ac) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix double .taskmaster directory paths in file resolution utilities
  - Closes #636

- [#671](https://github.com/eyaltoledano/claude-task-master/pull/671) [`86ea6d1`](https://github.com/eyaltoledano/claude-task-master/commit/86ea6d1dbc03eeb39f524f565b50b7017b1d2c9c) Thanks [@joedanz](https://github.com/joedanz)! - Add one-click MCP server installation for Cursor

- [#699](https://github.com/eyaltoledano/claude-task-master/pull/699) [`2e55757`](https://github.com/eyaltoledano/claude-task-master/commit/2e55757b2698ba20b78f09ec0286951297510b8e) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add sync-readme command for a task export to GitHub README

  Introduces a new `sync-readme` command that exports your task list to your project's README.md file.

  **Features:**
  - **Flexible filtering**: Supports `--status` filtering (e.g., pending, done) and `--with-subtasks` flag
  - **Smart content management**: Automatically replaces existing exports or appends to new READMEs
  - **Metadata display**: Shows export timestamp, subtask inclusion status, and filter settings

  **Usage:**
  - `task-master sync-readme` - Export tasks without subtasks
  - `task-master sync-readme --with-subtasks` - Include subtasks in export
  - `task-master sync-readme --status=pending` - Only export pending tasks
  - `task-master sync-readme --status=done --with-subtasks` - Export completed tasks with subtasks

  Perfect for showcasing project progress on GitHub. Experimental. Open to feedback.

## 0.16.2-rc.0

### Patch Changes

- [#655](https://github.com/eyaltoledano/claude-task-master/pull/655) [`edaa5fe`](https://github.com/eyaltoledano/claude-task-master/commit/edaa5fe0d56e0e4e7c4370670a7a388eebd922ac) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix double .taskmaster directory paths in file resolution utilities
  - Closes #636

- [#671](https://github.com/eyaltoledano/claude-task-master/pull/671) [`86ea6d1`](https://github.com/eyaltoledano/claude-task-master/commit/86ea6d1dbc03eeb39f524f565b50b7017b1d2c9c) Thanks [@joedanz](https://github.com/joedanz)! - Add one-click MCP server installation for Cursor

## 0.16.1

### Patch Changes

- [#641](https://github.com/eyaltoledano/claude-task-master/pull/641) [`ad61276`](https://github.com/eyaltoledano/claude-task-master/commit/ad612763ffbdd35aa1b593c9613edc1dc27a8856) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix bedrock issues

- [#648](https://github.com/eyaltoledano/claude-task-master/pull/648) [`9b4168b`](https://github.com/eyaltoledano/claude-task-master/commit/9b4168bb4e4dfc2f4fb0cf6bd5f81a8565879176) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP tool calls logging errors

- [#641](https://github.com/eyaltoledano/claude-task-master/pull/641) [`ad61276`](https://github.com/eyaltoledano/claude-task-master/commit/ad612763ffbdd35aa1b593c9613edc1dc27a8856) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Update rules for new directory structure

- [#648](https://github.com/eyaltoledano/claude-task-master/pull/648) [`9b4168b`](https://github.com/eyaltoledano/claude-task-master/commit/9b4168bb4e4dfc2f4fb0cf6bd5f81a8565879176) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix bug in expand_all mcp tool

- [#641](https://github.com/eyaltoledano/claude-task-master/pull/641) [`ad61276`](https://github.com/eyaltoledano/claude-task-master/commit/ad612763ffbdd35aa1b593c9613edc1dc27a8856) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix MCP crashing after certain commands due to console logs

## 0.16.0

### Minor Changes

- [#607](https://github.com/eyaltoledano/claude-task-master/pull/607) [`6a8a68e`](https://github.com/eyaltoledano/claude-task-master/commit/6a8a68e1a3f34dcdf40b355b4602a08d291f8e38) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add AWS bedrock support

- [#607](https://github.com/eyaltoledano/claude-task-master/pull/607) [`6a8a68e`](https://github.com/eyaltoledano/claude-task-master/commit/6a8a68e1a3f34dcdf40b355b4602a08d291f8e38) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - # Add Google Vertex AI Provider Integration
  - Implemented `VertexAIProvider` class extending BaseAIProvider
  - Added authentication and configuration handling for Vertex AI
  - Updated configuration manager with Vertex-specific getters
  - Modified AI services unified system to integrate the provider
  - Added documentation for Vertex AI setup and configuration
  - Updated environment variable examples for Vertex AI support
  - Implemented specialized error handling for Vertex-specific issues

- [#607](https://github.com/eyaltoledano/claude-task-master/pull/607) [`6a8a68e`](https://github.com/eyaltoledano/claude-task-master/commit/6a8a68e1a3f34dcdf40b355b4602a08d291f8e38) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add support for Azure

- [#612](https://github.com/eyaltoledano/claude-task-master/pull/612) [`669b744`](https://github.com/eyaltoledano/claude-task-master/commit/669b744ced454116a7b29de6c58b4b8da977186a) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Increased minimum required node version to > 18 (was > 14)

- [#607](https://github.com/eyaltoledano/claude-task-master/pull/607) [`6a8a68e`](https://github.com/eyaltoledano/claude-task-master/commit/6a8a68e1a3f34dcdf40b355b4602a08d291f8e38) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Renamed baseUrl to baseURL

- [#604](https://github.com/eyaltoledano/claude-task-master/pull/604) [`80735f9`](https://github.com/eyaltoledano/claude-task-master/commit/80735f9e60c7dda7207e169697f8ac07b6733634) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add TASK_MASTER_PROJECT_ROOT env variable supported in mcp.json and .env for project root resolution
  - Some users were having issues where the MCP wasn't able to detect the location of their project root, you can now set the `TASK_MASTER_PROJECT_ROOT` environment variable to the root of your project.

- [#619](https://github.com/eyaltoledano/claude-task-master/pull/619) [`3f64202`](https://github.com/eyaltoledano/claude-task-master/commit/3f64202c9feef83f2bf383c79e4367d337c37e20) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Consolidate Task Master files into unified .taskmaster directory structure

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

### Patch Changes

- [#607](https://github.com/eyaltoledano/claude-task-master/pull/607) [`6a8a68e`](https://github.com/eyaltoledano/claude-task-master/commit/6a8a68e1a3f34dcdf40b355b4602a08d291f8e38) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix max_tokens error when trying to use claude-sonnet-4 and claude-opus-4

- [#625](https://github.com/eyaltoledano/claude-task-master/pull/625) [`2d520de`](https://github.com/eyaltoledano/claude-task-master/commit/2d520de2694da3efe537b475ca52baf3c869edda) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix add-task MCP command causing an error

## 0.16.0-rc.0

### Minor Changes

- [#607](https://github.com/eyaltoledano/claude-task-master/pull/607) [`6a8a68e`](https://github.com/eyaltoledano/claude-task-master/commit/6a8a68e1a3f34dcdf40b355b4602a08d291f8e38) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add AWS bedrock support

- [#607](https://github.com/eyaltoledano/claude-task-master/pull/607) [`6a8a68e`](https://github.com/eyaltoledano/claude-task-master/commit/6a8a68e1a3f34dcdf40b355b4602a08d291f8e38) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - # Add Google Vertex AI Provider Integration
  - Implemented `VertexAIProvider` class extending BaseAIProvider
  - Added authentication and configuration handling for Vertex AI
  - Updated configuration manager with Vertex-specific getters
  - Modified AI services unified system to integrate the provider
  - Added documentation for Vertex AI setup and configuration
  - Updated environment variable examples for Vertex AI support
  - Implemented specialized error handling for Vertex-specific issues

- [#607](https://github.com/eyaltoledano/claude-task-master/pull/607) [`6a8a68e`](https://github.com/eyaltoledano/claude-task-master/commit/6a8a68e1a3f34dcdf40b355b4602a08d291f8e38) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add support for Azure

- [#612](https://github.com/eyaltoledano/claude-task-master/pull/612) [`669b744`](https://github.com/eyaltoledano/claude-task-master/commit/669b744ced454116a7b29de6c58b4b8da977186a) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Increased minimum required node version to > 18 (was > 14)

- [#607](https://github.com/eyaltoledano/claude-task-master/pull/607) [`6a8a68e`](https://github.com/eyaltoledano/claude-task-master/commit/6a8a68e1a3f34dcdf40b355b4602a08d291f8e38) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Renamed baseUrl to baseURL

- [#604](https://github.com/eyaltoledano/claude-task-master/pull/604) [`80735f9`](https://github.com/eyaltoledano/claude-task-master/commit/80735f9e60c7dda7207e169697f8ac07b6733634) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add TASK_MASTER_PROJECT_ROOT env variable supported in mcp.json and .env for project root resolution
  - Some users were having issues where the MCP wasn't able to detect the location of their project root, you can now set the `TASK_MASTER_PROJECT_ROOT` environment variable to the root of your project.

- [#619](https://github.com/eyaltoledano/claude-task-master/pull/619) [`3f64202`](https://github.com/eyaltoledano/claude-task-master/commit/3f64202c9feef83f2bf383c79e4367d337c37e20) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Consolidate Task Master files into unified .taskmaster directory structure

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

### Patch Changes

- [#607](https://github.com/eyaltoledano/claude-task-master/pull/607) [`6a8a68e`](https://github.com/eyaltoledano/claude-task-master/commit/6a8a68e1a3f34dcdf40b355b4602a08d291f8e38) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix max_tokens error when trying to use claude-sonnet-4 and claude-opus-4

- [#597](https://github.com/eyaltoledano/claude-task-master/pull/597) [`2d520de`](https://github.com/eyaltoledano/claude-task-master/commit/2d520de2694da3efe537b475ca52baf3c869edda) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fix add-task MCP command causing an error

## 0.15.0

### Minor Changes

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`09add37`](https://github.com/eyaltoledano/claude-task-master/commit/09add37423d70b809d5c28f3cde9fccd5a7e64e7) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Added comprehensive Ollama model validation and interactive setup support
  - **Interactive Setup Enhancement**: Added "Custom Ollama model" option to `task-master models --setup`, matching the existing OpenRouter functionality
  - **Live Model Validation**: When setting Ollama models, Taskmaster now validates against the local Ollama instance by querying `/api/tags` endpoint
  - **Configurable Endpoints**: Uses the `ollamaBaseUrl` from `.taskmasterconfig` (with role-specific `baseUrl` overrides supported)
  - **Robust Error Handling**:
    - Detects when Ollama server is not running and provides clear error messages
    - Validates model existence and lists available alternatives when model not found
    - Graceful fallback behavior for connection issues
  - **Full Platform Support**: Both MCP server tools and CLI commands support the new validation
  - **Improved User Experience**: Clear feedback during model validation with informative success/error messages

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`4c83526`](https://github.com/eyaltoledano/claude-task-master/commit/4c835264ac6c1f74896cddabc3b3c69a5c435417) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds and updates supported AI models with costs:
  - Added new OpenRouter models: GPT-4.1 series, O3, Codex Mini, Llama 4 Maverick, Llama 4 Scout, Qwen3-235b
  - Added Mistral models: Devstral Small, Mistral Nemo
  - Updated Ollama models with latest variants: Devstral, Qwen3, Mistral-small3.1, Llama3.3
  - Updated Gemini model to latest 2.5 Flash preview version

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`70f4054`](https://github.com/eyaltoledano/claude-task-master/commit/70f4054f268f9f8257870e64c24070263d4e2966) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add `--research` flag to parse-prd command, enabling enhanced task generation from PRD files. When used, Taskmaster leverages the research model to:
  - Research current technologies and best practices relevant to the project
  - Identify technical challenges and security concerns not explicitly mentioned in the PRD
  - Include specific library recommendations with version numbers
  - Provide more detailed implementation guidance based on industry standards
  - Create more accurate dependency relationships between tasks

  This results in higher quality, more actionable tasks with minimal additional effort.

  _NOTE_ That this is an experimental feature. Research models don't typically do great at structured output. You may find some failures when using research mode, so please share your feedback so we can improve this.

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`5e9bc28`](https://github.com/eyaltoledano/claude-task-master/commit/5e9bc28abea36ec7cd25489af7fcc6cbea51038b) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - This change significantly enhances the `add-task` command's intelligence. When you add a new task, Taskmaster now automatically: - Analyzes your existing tasks to find those most relevant to your new task's description. - Provides the AI with detailed context from these relevant tasks.

  This results in newly created tasks being more accurately placed within your project's dependency structure, saving you time and any need to update tasks just for dependencies, all without significantly increasing AI costs. You'll get smarter, more connected tasks right from the start.

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`34c769b`](https://github.com/eyaltoledano/claude-task-master/commit/34c769bcd0faf65ddec3b95de2ba152a8be3ec5c) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Enhance analyze-complexity to support analyzing specific task IDs. - You can now analyze individual tasks or selected task groups by using the new `--id` option with comma-separated IDs, or `--from` and `--to` options to specify a range of tasks. - The feature intelligently merges analysis results with existing reports, allowing incremental analysis while preserving previous results.

- [#558](https://github.com/eyaltoledano/claude-task-master/pull/558) [`86d8f00`](https://github.com/eyaltoledano/claude-task-master/commit/86d8f00af809887ee0ba0ba7157cc555e0d07c38) Thanks [@ShreyPaharia](https://github.com/ShreyPaharia)! - Add next task to set task status response
  Status: DONE

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`04af16d`](https://github.com/eyaltoledano/claude-task-master/commit/04af16de27295452e134b17b3c7d0f44bbb84c29) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add move command to enable moving tasks and subtasks within the task hierarchy. This new command supports moving standalone tasks to become subtasks, subtasks to become standalone tasks, and moving subtasks between different parents. The implementation handles circular dependencies, validation, and proper updating of parent-child relationships.

  **Usage:**
  - CLI command: `task-master move --from=<id> --to=<id>`
  - MCP tool: `move_task` with parameters:
    - `from`: ID of task/subtask to move (e.g., "5" or "5.2")
    - `to`: ID of destination (e.g., "7" or "7.3")
    - `file` (optional): Custom path to tasks.json

  **Example scenarios:**
  - Move task to become subtask: `--from="5" --to="7"`
  - Move subtask to standalone task: `--from="5.2" --to="7"`
  - Move subtask to different parent: `--from="5.2" --to="7.3"`
  - Reorder subtask within same parent: `--from="5.2" --to="5.4"`
  - Move multiple tasks at once: `--from="10,11,12" --to="16,17,18"`
  - Move task to new ID: `--from="5" --to="25"` (creates a new task with ID 25)

  **Multiple Task Support:**
  The command supports moving multiple tasks simultaneously by providing comma-separated lists for both `--from` and `--to` parameters. The number of source and destination IDs must match. This is particularly useful for resolving merge conflicts in task files when multiple team members have created tasks on different branches.

  **Validation Features:**
  - Allows moving tasks to new, non-existent IDs (automatically creates placeholders)
  - Prevents moving to existing task IDs that already contain content (to avoid overwriting)
  - Validates source tasks exist before attempting to move them
  - Ensures proper parent-child relationships are maintained

### Patch Changes

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`231e569`](https://github.com/eyaltoledano/claude-task-master/commit/231e569e84804a2e5ba1f9da1a985d0851b7e949) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adjusts default main model model to Claude Sonnet 4. Adjusts default fallback to Claude Sonney 3.7"

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`b371808`](https://github.com/eyaltoledano/claude-task-master/commit/b371808524f2c2986f4940d78fcef32c125d01f2) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds llms-install.md to the root to enable AI agents to programmatically install the Taskmaster MCP server. This is specifically being introduced for the Cline MCP marketplace and will be adjusted over time for other MCP clients as needed.

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`a59dd03`](https://github.com/eyaltoledano/claude-task-master/commit/a59dd037cfebb46d38bc44dd216c7c23933be641) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds AGENTS.md to power Claude Code integration more natively based on Anthropic's best practice and Claude-specific MCP client behaviours. Also adds in advanced workflows that tie Taskmaster commands together into one Claude workflow."

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`e0e1155`](https://github.com/eyaltoledano/claude-task-master/commit/e0e115526089bf41d5d60929956edf5601ff3e23) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fixes issue with force/append flag combinations for parse-prd.

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`34df2c8`](https://github.com/eyaltoledano/claude-task-master/commit/34df2c8bbddc0e157c981d32502bbe6b9468202e) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - You can now add tasks to a newly initialized project without having to parse a prd. This will automatically create the missing tasks.json file and create the first task. Lets you vibe if you want to vibe."

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`d2e6431`](https://github.com/eyaltoledano/claude-task-master/commit/d2e64318e2f4bfc3457792e310cc4ff9210bba30) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fixes an issue where the research fallback would attempt to make API calls without checking for a valid API key first. This ensures proper error handling when the main task generation and first fallback both fail. Closes #421 #519.

## 0.15.0-rc.0

### Minor Changes

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`09add37`](https://github.com/eyaltoledano/claude-task-master/commit/09add37423d70b809d5c28f3cde9fccd5a7e64e7) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Added comprehensive Ollama model validation and interactive setup support
  - **Interactive Setup Enhancement**: Added "Custom Ollama model" option to `task-master models --setup`, matching the existing OpenRouter functionality
  - **Live Model Validation**: When setting Ollama models, Taskmaster now validates against the local Ollama instance by querying `/api/tags` endpoint
  - **Configurable Endpoints**: Uses the `ollamaBaseUrl` from `.taskmasterconfig` (with role-specific `baseUrl` overrides supported)
  - **Robust Error Handling**:
    - Detects when Ollama server is not running and provides clear error messages
    - Validates model existence and lists available alternatives when model not found
    - Graceful fallback behavior for connection issues
  - **Full Platform Support**: Both MCP server tools and CLI commands support the new validation
  - **Improved User Experience**: Clear feedback during model validation with informative success/error messages

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`4c83526`](https://github.com/eyaltoledano/claude-task-master/commit/4c835264ac6c1f74896cddabc3b3c69a5c435417) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds and updates supported AI models with costs:
  - Added new OpenRouter models: GPT-4.1 series, O3, Codex Mini, Llama 4 Maverick, Llama 4 Scout, Qwen3-235b
  - Added Mistral models: Devstral Small, Mistral Nemo
  - Updated Ollama models with latest variants: Devstral, Qwen3, Mistral-small3.1, Llama3.3
  - Updated Gemini model to latest 2.5 Flash preview version

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`70f4054`](https://github.com/eyaltoledano/claude-task-master/commit/70f4054f268f9f8257870e64c24070263d4e2966) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add `--research` flag to parse-prd command, enabling enhanced task generation from PRD files. When used, Taskmaster leverages the research model to:
  - Research current technologies and best practices relevant to the project
  - Identify technical challenges and security concerns not explicitly mentioned in the PRD
  - Include specific library recommendations with version numbers
  - Provide more detailed implementation guidance based on industry standards
  - Create more accurate dependency relationships between tasks

  This results in higher quality, more actionable tasks with minimal additional effort.

  _NOTE_ That this is an experimental feature. Research models don't typically do great at structured output. You may find some failures when using research mode, so please share your feedback so we can improve this.

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`5e9bc28`](https://github.com/eyaltoledano/claude-task-master/commit/5e9bc28abea36ec7cd25489af7fcc6cbea51038b) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - This change significantly enhances the `add-task` command's intelligence. When you add a new task, Taskmaster now automatically: - Analyzes your existing tasks to find those most relevant to your new task's description. - Provides the AI with detailed context from these relevant tasks.

  This results in newly created tasks being more accurately placed within your project's dependency structure, saving you time and any need to update tasks just for dependencies, all without significantly increasing AI costs. You'll get smarter, more connected tasks right from the start.

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`34c769b`](https://github.com/eyaltoledano/claude-task-master/commit/34c769bcd0faf65ddec3b95de2ba152a8be3ec5c) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Enhance analyze-complexity to support analyzing specific task IDs. - You can now analyze individual tasks or selected task groups by using the new `--id` option with comma-separated IDs, or `--from` and `--to` options to specify a range of tasks. - The feature intelligently merges analysis results with existing reports, allowing incremental analysis while preserving previous results.

- [#558](https://github.com/eyaltoledano/claude-task-master/pull/558) [`86d8f00`](https://github.com/eyaltoledano/claude-task-master/commit/86d8f00af809887ee0ba0ba7157cc555e0d07c38) Thanks [@ShreyPaharia](https://github.com/ShreyPaharia)! - Add next task to set task status response
  Status: DONE

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`04af16d`](https://github.com/eyaltoledano/claude-task-master/commit/04af16de27295452e134b17b3c7d0f44bbb84c29) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Add move command to enable moving tasks and subtasks within the task hierarchy. This new command supports moving standalone tasks to become subtasks, subtasks to become standalone tasks, and moving subtasks between different parents. The implementation handles circular dependencies, validation, and proper updating of parent-child relationships.

  **Usage:**
  - CLI command: `task-master move --from=<id> --to=<id>`
  - MCP tool: `move_task` with parameters:
    - `from`: ID of task/subtask to move (e.g., "5" or "5.2")
    - `to`: ID of destination (e.g., "7" or "7.3")
    - `file` (optional): Custom path to tasks.json

  **Example scenarios:**
  - Move task to become subtask: `--from="5" --to="7"`
  - Move subtask to standalone task: `--from="5.2" --to="7"`
  - Move subtask to different parent: `--from="5.2" --to="7.3"`
  - Reorder subtask within same parent: `--from="5.2" --to="5.4"`
  - Move multiple tasks at once: `--from="10,11,12" --to="16,17,18"`
  - Move task to new ID: `--from="5" --to="25"` (creates a new task with ID 25)

  **Multiple Task Support:**
  The command supports moving multiple tasks simultaneously by providing comma-separated lists for both `--from` and `--to` parameters. The number of source and destination IDs must match. This is particularly useful for resolving merge conflicts in task files when multiple team members have created tasks on different branches.

  **Validation Features:**
  - Allows moving tasks to new, non-existent IDs (automatically creates placeholders)
  - Prevents moving to existing task IDs that already contain content (to avoid overwriting)
  - Validates source tasks exist before attempting to move them
  - Ensures proper parent-child relationships are maintained

### Patch Changes

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`231e569`](https://github.com/eyaltoledano/claude-task-master/commit/231e569e84804a2e5ba1f9da1a985d0851b7e949) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adjusts default main model model to Claude Sonnet 4. Adjusts default fallback to Claude Sonney 3.7"

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`b371808`](https://github.com/eyaltoledano/claude-task-master/commit/b371808524f2c2986f4940d78fcef32c125d01f2) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds llms-install.md to the root to enable AI agents to programmatically install the Taskmaster MCP server. This is specifically being introduced for the Cline MCP marketplace and will be adjusted over time for other MCP clients as needed.

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`a59dd03`](https://github.com/eyaltoledano/claude-task-master/commit/a59dd037cfebb46d38bc44dd216c7c23933be641) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds AGENTS.md to power Claude Code integration more natively based on Anthropic's best practice and Claude-specific MCP client behaviours. Also adds in advanced workflows that tie Taskmaster commands together into one Claude workflow."

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`e0e1155`](https://github.com/eyaltoledano/claude-task-master/commit/e0e115526089bf41d5d60929956edf5601ff3e23) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fixes issue with force/append flag combinations for parse-prd.

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`34df2c8`](https://github.com/eyaltoledano/claude-task-master/commit/34df2c8bbddc0e157c981d32502bbe6b9468202e) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - You can now add tasks to a newly initialized project without having to parse a prd. This will automatically create the missing tasks.json file and create the first task. Lets you vibe if you want to vibe."

- [#567](https://github.com/eyaltoledano/claude-task-master/pull/567) [`d2e6431`](https://github.com/eyaltoledano/claude-task-master/commit/d2e64318e2f4bfc3457792e310cc4ff9210bba30) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Fixes an issue where the research fallback would attempt to make API calls without checking for a valid API key first. This ensures proper error handling when the main task generation and first fallback both fail. Closes #421 #519.

## 0.14.0

### Minor Changes

- [#521](https://github.com/eyaltoledano/claude-task-master/pull/521) [`ed17cb0`](https://github.com/eyaltoledano/claude-task-master/commit/ed17cb0e0a04dedde6c616f68f24f3660f68dd04) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - .taskmasterconfig now supports a baseUrl field per model role (main, research, fallback), allowing endpoint overrides for any provider.

- [#536](https://github.com/eyaltoledano/claude-task-master/pull/536) [`f4a83ec`](https://github.com/eyaltoledano/claude-task-master/commit/f4a83ec047b057196833e3a9b861d4bceaec805d) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Ollama as a supported AI provider.
  - You can now add it by running `task-master models --setup` and selecting it.
  - Ollama is a local model provider, so no API key is required.
  - Ollama models are available at `http://localhost:11434/api` by default.
  - You can change the default URL by setting the `OLLAMA_BASE_URL` environment variable or by adding a `baseUrl` property to the `ollama` model role in `.taskmasterconfig`.
    - If you want to use a custom API key, you can set it in the `OLLAMA_API_KEY` environment variable.

- [#528](https://github.com/eyaltoledano/claude-task-master/pull/528) [`58b417a`](https://github.com/eyaltoledano/claude-task-master/commit/58b417a8ce697e655f749ca4d759b1c20014c523) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Display task complexity scores in task lists, next task, and task details views.

### Patch Changes

- [#402](https://github.com/eyaltoledano/claude-task-master/pull/402) [`01963af`](https://github.com/eyaltoledano/claude-task-master/commit/01963af2cb6f77f43b2ad8a6e4a838ec205412bc) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Resolve all issues related to MCP

- [#478](https://github.com/eyaltoledano/claude-task-master/pull/478) [`4117f71`](https://github.com/eyaltoledano/claude-task-master/commit/4117f71c18ee4d321a9c91308d00d5d69bfac61e) Thanks [@joedanz](https://github.com/joedanz)! - Fix CLI --force flag for parse-prd command

  Previously, the --force flag was not respected when running `parse-prd`, causing the command to prompt for confirmation or fail even when --force was provided. This patch ensures that the flag is correctly passed and handled, allowing users to overwrite existing tasks.json files as intended.
  - Fixes #477

- [#511](https://github.com/eyaltoledano/claude-task-master/pull/511) [`17294ff`](https://github.com/eyaltoledano/claude-task-master/commit/17294ff25918d64278674e558698a1a9ad785098) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Task Master no longer tells you to update when you're already up to date

- [#442](https://github.com/eyaltoledano/claude-task-master/pull/442) [`2b3ae8b`](https://github.com/eyaltoledano/claude-task-master/commit/2b3ae8bf89dc471c4ce92f3a12ded57f61faa449) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds costs information to AI commands using input/output tokens and model costs.

- [#402](https://github.com/eyaltoledano/claude-task-master/pull/402) [`01963af`](https://github.com/eyaltoledano/claude-task-master/commit/01963af2cb6f77f43b2ad8a6e4a838ec205412bc) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix ERR_MODULE_NOT_FOUND when trying to run MCP Server

- [#402](https://github.com/eyaltoledano/claude-task-master/pull/402) [`01963af`](https://github.com/eyaltoledano/claude-task-master/commit/01963af2cb6f77f43b2ad8a6e4a838ec205412bc) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add src directory to exports

- [#523](https://github.com/eyaltoledano/claude-task-master/pull/523) [`da317f2`](https://github.com/eyaltoledano/claude-task-master/commit/da317f2607ca34db1be78c19954996f634c40923) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix the error handling of task status settings

- [#527](https://github.com/eyaltoledano/claude-task-master/pull/527) [`a8dabf4`](https://github.com/eyaltoledano/claude-task-master/commit/a8dabf44856713f488960224ee838761716bba26) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Remove caching layer from MCP direct functions for task listing, next task, and complexity report
  - Fixes issues users where having where they were getting stale data

- [#417](https://github.com/eyaltoledano/claude-task-master/pull/417) [`a1f8d52`](https://github.com/eyaltoledano/claude-task-master/commit/a1f8d52474fdbdf48e17a63e3f567a6d63010d9f) Thanks [@ksylvan](https://github.com/ksylvan)! - Fix for issue #409 LOG_LEVEL Pydantic validation error

- [#442](https://github.com/eyaltoledano/claude-task-master/pull/442) [`0288311`](https://github.com/eyaltoledano/claude-task-master/commit/0288311965ae2a343ebee4a0c710dde94d2ae7e7) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Small fixes - `next` command no longer incorrectly suggests that subtasks be broken down into subtasks in the CLI - fixes the `append` flag so it properly works in the CLI

- [#501](https://github.com/eyaltoledano/claude-task-master/pull/501) [`0a61184`](https://github.com/eyaltoledano/claude-task-master/commit/0a611843b56a856ef0a479dc34078326e05ac3a8) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix initial .env.example to work out of the box
  - Closes #419

- [#435](https://github.com/eyaltoledano/claude-task-master/pull/435) [`a96215a`](https://github.com/eyaltoledano/claude-task-master/commit/a96215a359b25061fd3b3f3c7b10e8ac0390c062) Thanks [@lebsral](https://github.com/lebsral)! - Fix default fallback model and maxTokens in Taskmaster initialization

- [#517](https://github.com/eyaltoledano/claude-task-master/pull/517) [`e96734a`](https://github.com/eyaltoledano/claude-task-master/commit/e96734a6cc6fec7731de72eb46b182a6e3743d02) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix bug when updating tasks on the MCP server (#412)

- [#496](https://github.com/eyaltoledano/claude-task-master/pull/496) [`efce374`](https://github.com/eyaltoledano/claude-task-master/commit/efce37469bc58eceef46763ba32df1ed45242211) Thanks [@joedanz](https://github.com/joedanz)! - Fix duplicate output on CLI help screen
  - Prevent the Task Master CLI from printing the help screen more than once when using `-h` or `--help`.
  - Removed redundant manual event handlers and guards for help output; now only the Commander `.helpInformation` override is used for custom help.
  - Simplified logic so that help is only shown once for both "no arguments" and help flag flows.
  - Ensures a clean, branded help experience with no repeated content.
  - Fixes #339

## 0.14.0-rc.1

### Minor Changes

- [#536](https://github.com/eyaltoledano/claude-task-master/pull/536) [`f4a83ec`](https://github.com/eyaltoledano/claude-task-master/commit/f4a83ec047b057196833e3a9b861d4bceaec805d) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Add Ollama as a supported AI provider.
  - You can now add it by running `task-master models --setup` and selecting it.
  - Ollama is a local model provider, so no API key is required.
  - Ollama models are available at `http://localhost:11434/api` by default.
  - You can change the default URL by setting the `OLLAMA_BASE_URL` environment variable or by adding a `baseUrl` property to the `ollama` model role in `.taskmasterconfig`.
    - If you want to use a custom API key, you can set it in the `OLLAMA_API_KEY` environment variable.

### Patch Changes

- [#442](https://github.com/eyaltoledano/claude-task-master/pull/442) [`2b3ae8b`](https://github.com/eyaltoledano/claude-task-master/commit/2b3ae8bf89dc471c4ce92f3a12ded57f61faa449) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Adds costs information to AI commands using input/output tokens and model costs.

- [#442](https://github.com/eyaltoledano/claude-task-master/pull/442) [`0288311`](https://github.com/eyaltoledano/claude-task-master/commit/0288311965ae2a343ebee4a0c710dde94d2ae7e7) Thanks [@eyaltoledano](https://github.com/eyaltoledano)! - Small fixes - `next` command no longer incorrectly suggests that subtasks be broken down into subtasks in the CLI - fixes the `append` flag so it properly works in the CLI

## 0.14.0-rc.0

### Minor Changes

- [#521](https://github.com/eyaltoledano/claude-task-master/pull/521) [`ed17cb0`](https://github.com/eyaltoledano/claude-task-master/commit/ed17cb0e0a04dedde6c616f68f24f3660f68dd04) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - .taskmasterconfig now supports a baseUrl field per model role (main, research, fallback), allowing endpoint overrides for any provider.

- [#528](https://github.com/eyaltoledano/claude-task-master/pull/528) [`58b417a`](https://github.com/eyaltoledano/claude-task-master/commit/58b417a8ce697e655f749ca4d759b1c20014c523) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Display task complexity scores in task lists, next task, and task details views.

### Patch Changes

- [#478](https://github.com/eyaltoledano/claude-task-master/pull/478) [`4117f71`](https://github.com/eyaltoledano/claude-task-master/commit/4117f71c18ee4d321a9c91308d00d5d69bfac61e) Thanks [@joedanz](https://github.com/joedanz)! - Fix CLI --force flag for parse-prd command

  Previously, the --force flag was not respected when running `parse-prd`, causing the command to prompt for confirmation or fail even when --force was provided. This patch ensures that the flag is correctly passed and handled, allowing users to overwrite existing tasks.json files as intended.
  - Fixes #477

- [#511](https://github.com/eyaltoledano/claude-task-master/pull/511) [`17294ff`](https://github.com/eyaltoledano/claude-task-master/commit/17294ff25918d64278674e558698a1a9ad785098) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Task Master no longer tells you to update when you're already up to date

- [#523](https://github.com/eyaltoledano/claude-task-master/pull/523) [`da317f2`](https://github.com/eyaltoledano/claude-task-master/commit/da317f2607ca34db1be78c19954996f634c40923) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix the error handling of task status settings

- [#527](https://github.com/eyaltoledano/claude-task-master/pull/527) [`a8dabf4`](https://github.com/eyaltoledano/claude-task-master/commit/a8dabf44856713f488960224ee838761716bba26) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Remove caching layer from MCP direct functions for task listing, next task, and complexity report
  - Fixes issues users where having where they were getting stale data

- [#417](https://github.com/eyaltoledano/claude-task-master/pull/417) [`a1f8d52`](https://github.com/eyaltoledano/claude-task-master/commit/a1f8d52474fdbdf48e17a63e3f567a6d63010d9f) Thanks [@ksylvan](https://github.com/ksylvan)! - Fix for issue #409 LOG_LEVEL Pydantic validation error

- [#501](https://github.com/eyaltoledano/claude-task-master/pull/501) [`0a61184`](https://github.com/eyaltoledano/claude-task-master/commit/0a611843b56a856ef0a479dc34078326e05ac3a8) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix initial .env.example to work out of the box
  - Closes #419

- [#435](https://github.com/eyaltoledano/claude-task-master/pull/435) [`a96215a`](https://github.com/eyaltoledano/claude-task-master/commit/a96215a359b25061fd3b3f3c7b10e8ac0390c062) Thanks [@lebsral](https://github.com/lebsral)! - Fix default fallback model and maxTokens in Taskmaster initialization

- [#517](https://github.com/eyaltoledano/claude-task-master/pull/517) [`e96734a`](https://github.com/eyaltoledano/claude-task-master/commit/e96734a6cc6fec7731de72eb46b182a6e3743d02) Thanks [@Crunchyman-ralph](https://github.com/Crunchyman-ralph)! - Fix bug when updating tasks on the MCP server (#412)

- [#496](https://github.com/eyaltoledano/claude-task-master/pull/496) [`efce374`](https://github.com/eyaltoledano/claude-task-master/commit/efce37469bc58eceef46763ba32df1ed45242211) Thanks [@joedanz](https://github.com/joedanz)! - Fix duplicate output on CLI help screen
  - Prevent the Task Master CLI from printing the help screen more than once when using `-h` or `--help`.
  - Removed redundant manual event handlers and guards for help output; now only the Commander `.helpInformation` override is used for custom help.
  - Simplified logic so that help is only shown once for both "no arguments" and help flag flows.
  - Ensures a clean, branded help experience with no repeated content.
  - Fixes #339

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
