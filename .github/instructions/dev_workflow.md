---
description: Guide for using Taskmaster to manage task-driven development workflows
applyTo: "**/*"
alwaysApply: true
---

# Taskmaster Development Workflow

This guide outlines the standard process for using Taskmaster to manage software development projects. It is written as a set of instructions for you, the AI agent.

- **Your Default Stance**: For most projects, the user can work directly within the `master` task context. Your initial actions should operate on this default context unless a clear pattern for multi-context work emerges.
- **Your Goal**: Your role is to elevate the user's workflow by intelligently introducing advanced features like **Tagged Task Lists** when you detect the appropriate context. Do not force tags on the user; suggest them as a helpful solution to a specific need.

## The Basic Loop
The fundamental development cycle you will facilitate is:
1.  **`list`**: Show the user what needs to be done.
2.  **`next`**: Help the user decide what to work on.
3.  **`show <id>`**: Provide details for a specific task.
4.  **`expand <id>`**: Break down a complex task into smaller, manageable subtasks.
5.  **Implement**: The user writes the code and tests.
6.  **`update-subtask`**: Log progress and findings on behalf of the user.
7.  **`set-status`**: Mark tasks and subtasks as `done` as work is completed.
8.  **Repeat**.

All your standard command executions should operate on the user's current task context, which defaults to `master`.

---

## Standard Development Workflow Process

### Simple Workflow (Default Starting Point)

For new projects or when users are getting started, operate within the `master` tag context:

-   Start new projects by running `initialize_project` tool / `task-master init` or `parse_prd` / `task-master parse-prd --input='<prd-file.txt>'` (see @`taskmaster.md`) to generate initial tasks.json with tagged structure
-   Configure rule sets during initialization with `--rules` flag (e.g., `task-master init --rules vscode,windsurf`) or manage them later with `task-master rules add/remove` commands  
-   Begin coding sessions with `get_tasks` / `task-master list` (see @`taskmaster.md`) to see current tasks, status, and IDs
-   Determine the next task to work on using `next_task` / `task-master next` (see @`taskmaster.md`)
-   Analyze task complexity with `analyze_project_complexity` / `task-master analyze-complexity --research` (see @`taskmaster.md`) before breaking down tasks
-   Review complexity report using `complexity_report` / `task-master complexity-report` (see @`taskmaster.md`)
-   Select tasks based on dependencies (all marked 'done'), priority level, and ID order
-   View specific task details using `get_task` / `task-master show <id>` (see @`taskmaster.md`) to understand implementation requirements
-   Break down complex tasks using `expand_task` / `task-master expand --id=<id> --force --research` (see @`taskmaster.md`) with appropriate flags like `--force` (to replace existing subtasks) and `--research`
-   Implement code following task details, dependencies, and project standards
-   Mark completed tasks with `set_task_status` / `task-master set-status --id=<id> --status=done` (see @`taskmaster.md`)
-   Update dependent tasks when implementation differs from original plan using `update` / `task-master update --from=<id> --prompt="..."` or `update_task` / `task-master update-task --id=<id> --prompt="..."` (see @`taskmaster.md`)

---

## Leveling Up: Agent-Led Multi-Context Workflows

While the basic workflow is powerful, your primary opportunity to add value is by identifying when to introduce **Tagged Task Lists**. These patterns are your tools for creating a more organized and efficient development environment for the user, especially if you detect agentic or parallel development happening across the same session.

**Critical Principle**: Most users should never see a difference in their experience. Only introduce advanced workflows when you detect clear indicators that the project has evolved beyond simple task management.

### When to Introduce Tags: Your Decision Patterns

Here are the patterns to look for. When you detect one, you should propose the corresponding workflow to the user.

#### Pattern 1: Simple Git Feature Branching
This is the most common and direct use case for tags.

- **Trigger**: The user creates a new git branch (e.g., `git checkout -b feature/user-auth`).
- **Your Action**: Propose creating a new tag that mirrors the branch name to isolate the feature's tasks from `master`.
- **Your Suggested Prompt**: *"I see you've created a new branch named 'feature/user-auth'. To keep all related tasks neatly organized and separate from your main list, I can create a corresponding task tag for you. This helps prevent merge conflicts in your `tasks.json` file later. Shall I create the 'feature-user-auth' tag?"*
- **Tool to Use**: `task-master add-tag --from-branch`

#### Pattern 2: Team Collaboration
- **Trigger**: The user mentions working with teammates (e.g., "My teammate Alice is handling the database schema," or "I need to review Bob's work on the API.").
- **Your Action**: Suggest creating a separate tag for the user's work to prevent conflicts with shared master context.
- **Your Suggested Prompt**: *"Since you're working with Alice, I can create a separate task context for your work to avoid conflicts. This way, Alice can continue working with the master list while you have your own isolated context. When you're ready to merge your work, we can coordinate the tasks back to master. Shall I create a tag for your current work?"*
- **Tool to Use**: `task-master add-tag my-work --copy-from-current --description="My tasks while collaborating with Alice"`

#### Pattern 3: Experiments or Risky Refactors
- **Trigger**: The user wants to try something that might not be kept (e.g., "I want to experiment with switching our state management library," or "Let's refactor the old API module, but I want to keep the current tasks as a reference.").
- **Your Action**: Propose creating a sandboxed tag for the experimental work.
- **Your Suggested Prompt**: *"This sounds like a great experiment. To keep these new tasks separate from our main plan, I can create a temporary 'experiment-zustand' tag for this work. If we decide not to proceed, we can simply delete the tag without affecting the main task list. Sound good?"*
- **Tool to Use**: `task-master add-tag experiment-zustand --description="Exploring Zustand migration"`

#### Pattern 4: Large Feature Initiatives (PRD-Driven)
This is a more structured approach for significant new features or epics.

- **Trigger**: The user describes a large, multi-step feature that would benefit from a formal plan.
- **Your Action**: Propose a comprehensive, PRD-driven workflow.
- **Your Suggested Prompt**: *"This sounds like a significant new feature. To manage this effectively, I suggest we create a dedicated task context for it. Here's the plan: I'll create a new tag called 'feature-xyz', then we can draft a Product Requirements Document (PRD) together to scope the work. Once the PRD is ready, I'll automatically generate all the necessary tasks within that new tag. How does that sound?"*
- **Your Implementation Flow**:
    1.  **Create an empty tag**: `task-master add-tag feature-xyz --description "Tasks for the new XYZ feature"`. You can also start by creating a git branch if applicable, and then create the tag from that branch.
    2.  **Collaborate & Create PRD**: Work with the user to create a detailed PRD file (e.g., `.taskmaster/docs/feature-xyz-prd.txt`).
    3.  **Parse PRD into the new tag**: `task-master parse-prd .taskmaster/docs/feature-xyz-prd.txt --tag feature-xyz`
    4.  **Prepare the new task list**: Follow up by suggesting `analyze-complexity` and `expand-all` for the newly created tasks within the `feature-xyz` tag.

#### Pattern 5: Version-Based Development
Tailor your approach based on the project maturity indicated by tag names.

- **Prototype/MVP Tags** (`prototype`, `mvp`, `poc`, `v0.x`):
  - **Your Approach**: Focus on speed and functionality over perfection
  - **Task Generation**: Create tasks that emphasize "get it working" over "get it perfect"
  - **Complexity Level**: Lower complexity, fewer subtasks, more direct implementation paths
  - **Research Prompts**: Include context like "This is a prototype - prioritize speed and basic functionality over optimization"
  - **Example Prompt Addition**: *"Since this is for the MVP, I'll focus on tasks that get core functionality working quickly rather than over-engineering."*

- **Production/Mature Tags** (`v1.0+`, `production`, `stable`):
  - **Your Approach**: Emphasize robustness, testing, and maintainability
  - **Task Generation**: Include comprehensive error handling, testing, documentation, and optimization
  - **Complexity Level**: Higher complexity, more detailed subtasks, thorough implementation paths
  - **Research Prompts**: Include context like "This is for production - prioritize reliability, performance, and maintainability"
  - **Example Prompt Addition**: *"Since this is for production, I'll ensure tasks include proper error handling, testing, and documentation."*

### Advanced Workflow (Tag-Based & PRD-Driven)

**When to Transition**: Recognize when the project has evolved (or has initiated a project which existing code) beyond simple task management. Look for these indicators:
- User mentions teammates or collaboration needs
- Project has grown to 15+ tasks with mixed priorities
- User creates feature branches or mentions major initiatives
- User initializes Taskmaster on an existing, complex codebase
- User describes large features that would benefit from dedicated planning

**Your Role in Transition**: Guide the user to a more sophisticated workflow that leverages tags for organization and PRDs for comprehensive planning.

#### Master List Strategy (High-Value Focus)
Once you transition to tag-based workflows, the `master` tag should ideally contain only:
- **High-level deliverables** that provide significant business value
- **Major milestones** and epic-level features
- **Critical infrastructure** work that affects the entire project
- **Release-blocking** items

**What NOT to put in master**:
- Detailed implementation subtasks (these go in feature-specific tags' parent tasks)
- Refactoring work (create dedicated tags like `refactor-auth`)
- Experimental features (use `experiment-*` tags)
- Team member-specific tasks (use person-specific tags)

#### PRD-Driven Feature Development

**For New Major Features**:
1. **Identify the Initiative**: When user describes a significant feature
2. **Create Dedicated Tag**: `add_tag feature-[name] --description="[Feature description]"`
3. **Collaborative PRD Creation**: Work with user to create comprehensive PRD in `.taskmaster/docs/feature-[name]-prd.txt`
4. **Parse & Prepare**: 
   - `parse_prd .taskmaster/docs/feature-[name]-prd.txt --tag=feature-[name]`
   - `analyze_project_complexity --tag=feature-[name] --research`
   - `expand_all --tag=feature-[name] --research`
5. **Add Master Reference**: Create a high-level task in `master` that references the feature tag

**For Existing Codebase Analysis**:
When users initialize Taskmaster on existing projects:
1. **Codebase Discovery**: Use your native tools for producing deep context about the code base. You may use `research` tool with `--tree` and `--files` to collect up to date information using the existing architecture as context.
2. **Collaborative Assessment**: Work with user to identify improvement areas, technical debt, or new features
3. **Strategic PRD Creation**: Co-author PRDs that include:
   - Current state analysis (based on your codebase research)
   - Proposed improvements or new features
   - Implementation strategy considering existing code
4. **Tag-Based Organization**: Parse PRDs into appropriate tags (`refactor-api`, `feature-dashboard`, `tech-debt`, etc.)
5. **Master List Curation**: Keep only the most valuable initiatives in master

The parse-prd's `--append` flag enables the user to parse multple PRDs within tags or across tags. PRDs should be focused and the number of tasks they are parsed into should be strategically chosen relative to the PRD's complexity and level of detail.

### Workflow Transition Examples

**Example 1: Simple → Team-Based**
```
User: "Alice is going to help with the API work"
Your Response: "Great! To avoid conflicts, I'll create a separate task context for your work. Alice can continue with the master list while you work in your own context. When you're ready to merge, we can coordinate the tasks back together."
Action: add_tag my-api-work --copy-from-current --description="My API tasks while collaborating with Alice"
```

**Example 2: Simple → PRD-Driven**
```
User: "I want to add a complete user dashboard with analytics, user management, and reporting"
Your Response: "This sounds like a major feature that would benefit from detailed planning. Let me create a dedicated context for this work and we can draft a PRD together to ensure we capture all requirements."
Actions: 
1. add_tag feature-dashboard --description="User dashboard with analytics and management"
2. Collaborate on PRD creation
3. parse_prd dashboard-prd.txt --tag=feature-dashboard
4. Add high-level "User Dashboard" task to master
```

**Example 3: Existing Project → Strategic Planning**
```
User: "I just initialized Taskmaster on my existing React app. It's getting messy and I want to improve it."
Your Response: "Let me research your codebase to understand the current architecture, then we can create a strategic plan for improvements."
Actions:
1. research "Current React app architecture and improvement opportunities" --tree --files=src/
2. Collaborate on improvement PRD based on findings
3. Create tags for different improvement areas (refactor-components, improve-state-management, etc.)
4. Keep only major improvement initiatives in master
```

---

## Primary Interaction: MCP Server vs. CLI

Taskmaster offers two primary ways to interact:

1.  **MCP Server (Recommended for Integrated Tools)**:
    - For AI agents and integrated development environments (like VS Code), interacting via the **MCP server is the preferred method**.
    - The MCP server exposes Taskmaster functionality through a set of tools (e.g., `get_tasks`, `add_subtask`).
    - This method offers better performance, structured data exchange, and richer error handling compared to CLI parsing.
    - Refer to @`mcp.md` for details on the MCP architecture and available tools.
    - A comprehensive list and description of MCP tools and their corresponding CLI commands can be found in @`taskmaster.md`.
    - **Restart the MCP server** if core logic in `scripts/modules` or MCP tool/direct function definitions change.
    - **Note**: MCP tools fully support tagged task lists with complete tag management capabilities.

2.  **`task-master` CLI (For Users & Fallback)**:
    - The global `task-master` command provides a user-friendly interface for direct terminal interaction.
    - It can also serve as a fallback if the MCP server is inaccessible or a specific function isn't exposed via MCP.
    - Install globally with `npm install -g task-master-ai` or use locally via `npx task-master-ai ...`.
    - The CLI commands often mirror the MCP tools (e.g., `task-master list` corresponds to `get_tasks`).
    - Refer to @`taskmaster.md` for a detailed command reference.
    - **Tagged Task Lists**: CLI fully supports the new tagged system with seamless migration.

## How the Tag System Works (For Your Reference)

- **Data Structure**: Tasks are organized into separate contexts (tags) like "master", "feature-branch", or "v2.0".
- **Silent Migration**: Existing projects automatically migrate to use a "master" tag with zero disruption.
- **Context Isolation**: Tasks in different tags are completely separate. Changes in one tag do not affect any other tag.
- **Manual Control**: The user is always in control. There is no automatic switching. You facilitate switching by using `use-tag <name>`.
- **Full CLI & MCP Support**: All tag management commands are available through both the CLI and MCP tools for you to use. Refer to @`taskmaster.md` for a full command list.

---

## Task Complexity Analysis

-   Run `analyze_project_complexity` / `task-master analyze-complexity --research` (see @`taskmaster.md`) for comprehensive analysis
-   Review complexity report via `complexity_report` / `task-master complexity-report` (see @`taskmaster.md`) for a formatted, readable version.
-   Focus on tasks with highest complexity scores (8-10) for detailed breakdown
-   Use analysis results to determine appropriate subtask allocation
-   Note that reports are automatically used by the `expand_task` tool/command

## Task Breakdown Process

-   Use `expand_task` / `task-master expand --id=<id>`. It automatically uses the complexity report if found, otherwise generates default number of subtasks.
-   Use `--num=<number>` to specify an explicit number of subtasks, overriding defaults or complexity report recommendations.
-   Add `--research` flag to leverage Perplexity AI for research-backed expansion.
-   Add `--force` flag to clear existing subtasks before generating new ones (default is to append).
-   Use `--prompt="<context>"` to provide additional context when needed.
-   Review and adjust generated subtasks as necessary.
-   Use `expand_all` tool or `task-master expand --all` to expand multiple pending tasks at once, respecting flags like `--force` and `--research`.
-   If subtasks need complete replacement (regardless of the `--force` flag on `expand`), clear them first with `clear_subtasks` / `task-master clear-subtasks --id=<id>`.

## Implementation Drift Handling

-   When implementation differs significantly from planned approach
-   When future tasks need modification due to current implementation choices
-   When new dependencies or requirements emerge
-   Use `update` / `task-master update --from=<futureTaskId> --prompt='<explanation>\nUpdate context...' --research` to update multiple future tasks.
-   Use `update_task` / `task-master update-task --id=<taskId> --prompt='<explanation>\nUpdate context...' --research` to update a single specific task.

## Task Status Management

-   Use 'pending' for tasks ready to be worked on
-   Use 'done' for completed and verified tasks
-   Use 'deferred' for postponed tasks
-   Add custom status values as needed for project-specific workflows

## Task Structure Fields

- **id**: Unique identifier for the task (Example: `1`, `1.1`)
- **title**: Brief, descriptive title (Example: `"Initialize Repo"`)
- **description**: Concise summary of what the task involves (Example: `"Create a new repository, set up initial structure."`)
- **status**: Current state of the task (Example: `"pending"`, `"done"`, `"deferred"`)
- **dependencies**: IDs of prerequisite tasks (Example: `[1, 2.1]`)
    - Dependencies are displayed with status indicators (✅ for completed, ⏱️ for pending)
    - This helps quickly identify which prerequisite tasks are blocking work
- **priority**: Importance level (Example: `"high"`, `"medium"`, `"low"`)
- **details**: In-depth implementation instructions (Example: `"Use GitHub client ID/secret, handle callback, set session token."`) 
- **testStrategy**: Verification approach (Example: `"Deploy and call endpoint to confirm 'Hello World' response."`) 
- **subtasks**: List of smaller, more specific tasks (Example: `[{"id": 1, "title": "Configure OAuth", ...}]`) 
- Refer to task structure details (previously linked to `tasks.md`).

## Configuration Management (Updated)

Taskmaster configuration is managed through two main mechanisms:

1.  **`.taskmaster/config.json` File (Primary):**
    *   Located in the project root directory.
    *   Stores most configuration settings: AI model selections (main, research, fallback), parameters (max tokens, temperature), logging level, default subtasks/priority, project name, etc.
    *   **Tagged System Settings**: Includes `global.defaultTag` (defaults to "master") and `tags` section for tag management configuration.
    *   **Managed via `task-master models --setup` command.** Do not edit manually unless you know what you are doing.
    *   **View/Set specific models via `task-master models` command or `models` MCP tool.**
    *   Created automatically when you run `task-master models --setup` for the first time or during tagged system migration.

2.  **Environment Variables (`.env` / `mcp.json`):**
    *   Used **only** for sensitive API keys and specific endpoint URLs.
    *   Place API keys (one per provider) in a `.env` file in the project root for CLI usage.
    *   For MCP/VS Code integration, configure these keys in the `env` section of `.vscode/mcp.json`.
    *   Available keys/variables: See `assets/env.example` or the Configuration section in the command reference (previously linked to `taskmaster.md`).

3.  **`.taskmaster/state.json` File (Tagged System State):**
    *   Tracks current tag context and migration status.
    *   Automatically created during tagged system migration.
    *   Contains: `currentTag`, `lastSwitched`, `migrationNoticeShown`.

**Important:** Non-API key settings (like model selections, `MAX_TOKENS`, `TASKMASTER_LOG_LEVEL`) are **no longer configured via environment variables**. Use the `task-master models` command (or `--setup` for interactive configuration) or the `models` MCP tool.
**If AI commands FAIL in MCP** verify that the API key for the selected provider is present in the `env` section of `.vscode/mcp.json`.
**If AI commands FAIL in CLI** verify that the API key for the selected provider is present in the `.env` file in the root of the project.

## Rules Management

Taskmaster supports multiple AI coding assistant rule sets that can be configured during project initialization or managed afterward:

- **Available Profiles**: Claude Code, Cline, Codex, VS Code, Roo Code, Trae, Windsurf (claude, cline, codex, vscode, roo, trae, windsurf)
- **During Initialization**: Use `task-master init --rules vscode,windsurf` to specify which rule sets to include
- **After Initialization**: Use `task-master rules add <profiles>` or `task-master rules remove <profiles>` to manage rule sets
- **Interactive Setup**: Use `task-master rules setup` to launch an interactive prompt for selecting rule profiles
- **Default Behavior**: If no `--rules` flag is specified during initialization, all available rule profiles are included
- **Rule Structure**: Each profile creates its own directory (e.g., `.github/instructions`, `.roo/rules`) with appropriate configuration files

## Determining the Next Task

- Run `next_task` / `task-master next` to show the next task to work on.
- The command identifies tasks with all dependencies satisfied
- Tasks are prioritized by priority level, dependency count, and ID
- The command shows comprehensive task information including:
    - Basic task details and description
    - Implementation details
    - Subtasks (if they exist)
    - Contextual suggested actions
- Recommended before starting any new development work
- Respects your project's dependency structure
- Ensures tasks are completed in the appropriate sequence
- Provides ready-to-use commands for common task actions

## Viewing Specific Task Details

- Run `get_task` / `task-master show <id>` to view a specific task.
- Use dot notation for subtasks: `task-master show 1.2` (shows subtask 2 of task 1)
- Displays comprehensive information similar to the next command, but for a specific task
- For parent tasks, shows all subtasks and their current status
- For subtasks, shows parent task information and relationship
- Provides contextual suggested actions appropriate for the specific task
- Useful for examining task details before implementation or checking status

## Managing Task Dependencies

- Use `add_dependency` / `task-master add-dependency --id=<id> --depends-on=<id>` to add a dependency.
- Use `remove_dependency` / `task-master remove-dependency --id=<id> --depends-on=<id>` to remove a dependency.
- The system prevents circular dependencies and duplicate dependency entries
- Dependencies are checked for existence before being added or removed
- Task files are automatically regenerated after dependency changes
- Dependencies are visualized with status indicators in task listings and files

## Task Reorganization

- Use `move_task` / `task-master move --from=<id> --to=<id>` to move tasks or subtasks within the hierarchy
- This command supports several use cases:
  - Moving a standalone task to become a subtask (e.g., `--from=5 --to=7`)
  - Moving a subtask to become a standalone task (e.g., `--from=5.2 --to=7`) 
  - Moving a subtask to a different parent (e.g., `--from=5.2 --to=7.3`)
  - Reordering subtasks within the same parent (e.g., `--from=5.2 --to=5.4`)
  - Moving a task to a new, non-existent ID position (e.g., `--from=5 --to=25`)
  - Moving multiple tasks at once using comma-separated IDs (e.g., `--from=10,11,12 --to=16,17,18`)
- The system includes validation to prevent data loss:
  - Allows moving to non-existent IDs by creating placeholder tasks
  - Prevents moving to existing task IDs that have content (to avoid overwriting)
  - Validates source tasks exist before attempting to move them
- The system maintains proper parent-child relationships and dependency integrity
- Task files are automatically regenerated after the move operation
- This provides greater flexibility in organizing and refining your task structure as project understanding evolves
- This is especially useful when dealing with potential merge conflicts arising from teams creating tasks on separate branches. Solve these conflicts very easily by moving your tasks and keeping theirs.

## Iterative Subtask Implementation

Once a task has been broken down into subtasks using `expand_task` or similar methods, follow this iterative process for implementation:

1.  **Understand the Goal (Preparation):**
    *   Use `get_task` / `task-master show <subtaskId>` (see @`taskmaster.md`) to thoroughly understand the specific goals and requirements of the subtask.

2.  **Initial Exploration & Planning (Iteration 1):**
    *   This is the first attempt at creating a concrete implementation plan.
    *   Explore the codebase to identify the precise files, functions, and even specific lines of code that will need modification.
    *   Determine the intended code changes (diffs) and their locations.
    *   Gather *all* relevant details from this exploration phase.

3.  **Log the Plan:**
    *   Run `update_subtask` / `task-master update-subtask --id=<subtaskId> --prompt='<detailed plan>'`.
    *   Provide the *complete and detailed* findings from the exploration phase in the prompt. Include file paths, line numbers, proposed diffs, reasoning, and any potential challenges identified. Do not omit details. The goal is to create a rich, timestamped log within the subtask's `details`.

4.  **Verify the Plan:**
    *   Run `get_task` / `task-master show <subtaskId>` again to confirm that the detailed implementation plan has been successfully appended to the subtask's details.

5.  **Begin Implementation:**
    *   Set the subtask status using `set_task_status` / `task-master set-status --id=<subtaskId> --status=in-progress`.
    *   Start coding based on the logged plan.

6.  **Refine and Log Progress (Iteration 2+):**
    *   As implementation progresses, you will encounter challenges, discover nuances, or confirm successful approaches.
    *   **Before appending new information**: Briefly review the *existing* details logged in the subtask (using `get_task` or recalling from context) to ensure the update adds fresh insights and avoids redundancy.
    *   **Regularly** use `update_subtask` / `task-master update-subtask --id=<subtaskId> --prompt='<update details>\n- What worked...\n- What didn't work...'` to append new findings.
    *   **Crucially, log:**
        *   What worked ("fundamental truths" discovered).
        *   What didn't work and why (to avoid repeating mistakes).
        *   Specific code snippets or configurations that were successful.
        *   Decisions made, especially if confirmed with user input.
        *   Any deviations from the initial plan and the reasoning.
    *   The objective is to continuously enrich the subtask's details, creating a log of the implementation journey that helps the AI (and human developers) learn, adapt, and avoid repeating errors.

7.  **Review & Update Rules (Post-Implementation):**
    *   Once the implementation for the subtask is functionally complete, review all code changes and the relevant chat history.
    *   Identify any new or modified code patterns, conventions, or best practices established during the implementation.
    *   Create new or update existing rules following internal guidelines (previously linked to `cursor_rules.md` and `self_improve.md`).

8.  **Mark Task Complete:**
    *   After verifying the implementation and updating any necessary rules, mark the subtask as completed: `set_task_status` / `task-master set-status --id=<subtaskId> --status=done`.

9.  **Commit Changes (If using Git):**
    *   Stage the relevant code changes and any updated/new rule files (`git add .`).
    *   Craft a comprehensive Git commit message summarizing the work done for the subtask, including both code implementation and any rule adjustments.
    *   Execute the commit command directly in the terminal (e.g., `git commit -m 'feat(module): Implement feature X for subtask <subtaskId>\n\n- Details about changes...\n- Updated rule Y for pattern Z'`).
    *   Consider if a Changeset is needed according to internal versioning guidelines (previously linked to `changeset.md`). If so, run `npm run changeset`, stage the generated file, and amend the commit or create a new one.

10. **Proceed to Next Subtask:**
    *   Identify the next subtask (e.g., using `next_task` / `task-master next`).

## Code Analysis & Refactoring Techniques

- **Top-Level Function Search**:
    - Useful for understanding module structure or planning refactors.
    - Use grep/ripgrep to find exported functions/constants:
      `rg "export (async function|function|const) \w+"` or similar patterns.
    - Can help compare functions between files during migrations or identify potential naming conflicts.

---
*This workflow provides a general guideline. Adapt it based on your specific project needs and team practices.*