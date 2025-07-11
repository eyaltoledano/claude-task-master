---
description: Comprehensive reference for Taskmaster MCP tools and CLI commands.
globs: **/*
alwaysApply: true
---

# Taskmaster Tool & Command Reference

This document provides a detailed reference for interacting with Taskmaster, covering both the recommended MCP tools, suitable for integrations like Trae, and the corresponding `task-master` CLI commands, designed for direct user interaction or fallback.

**Note:** For interacting with Taskmaster programmatically or via integrated tools, using the **MCP tools is strongly recommended** due to better performance, structured data, and error handling. The CLI commands serve as a user-friendly alternative and fallback. 

**Important:** Several MCP tools involve AI processing... The AI-powered tools include `parse_prd`, `analyze_project_complexity`, `update_subtask`, `update_task`, `update`, `expand_all`, `expand_task`, and `add_task`.

**🏷️ Tagged Task Lists System:** Task Master now supports **tagged task lists** for multi-context task management. This allows you to maintain separate, isolated lists of tasks for different features, branches, or experiments. Existing projects are seamlessly migrated to use a default "master" tag. Most commands now support a `--tag <name>` flag to specify which context to operate on. If omitted, commands use the currently active tag.

---

## Initialization & Setup

### 1. Initialize Project (`init`)

*   **MCP Tool:** `initialize_project`
*   **CLI Command:** `task-master init [options]`
*   **Description:** `Set up the basic Taskmaster file structure and configuration in the current directory for a new project.`
*   **Key CLI Options:**
    *   `--name <name>`: `Set the name for your project in Taskmaster's configuration.`
    *   `--description <text>`: `Provide a brief description for your project.`
    *   `--version <version>`: `Set the initial version for your project, e.g., '0.1.0'.`
    *   `-y, --yes`: `Initialize Taskmaster quickly using default settings without interactive prompts.`
*   **Usage:** Run this once at the beginning of a new project.
*   **MCP Variant Description:** `Set up the basic Taskmaster file structure and configuration in the current directory for a new project by running the 'task-master init' command.`
*   **Key MCP Parameters/Options:**
    *   `projectName`: `Set the name for your project.` (CLI: `--name <name>`)
    *   `projectDescription`: `Provide a brief description for your project.` (CLI: `--description <text>`)
    *   `projectVersion`: `Set the initial version for your project, e.g., '0.1.0'.` (CLI: `--version <version>`)
    *   `authorName`: `Author name.` (CLI: `--author <author>`)
    *   `skipInstall`: `Skip installing dependencies. Default is false.` (CLI: `--skip-install`)
    *   `addAliases`: `Add shell aliases tm and taskmaster. Default is false.` (CLI: `--aliases`)
    *   `yes`: `Skip prompts and use defaults/provided arguments. Default is false.` (CLI: `-y, --yes`)
*   **Usage:** Run this once at the beginning of a new project, typically via an integrated tool like Trae. Operates on the current working directory of the MCP server. 
*   **Important:** Once complete, you *MUST* parse a prd in order to generate tasks. There will be no tasks files until then. The next step after initializing should be to create a PRD using the example PRD in .taskmaster/templates/example_prd.txt. 
*   **Tagging:** Use the `--tag` option to parse the PRD into a specific, non-default tag context. If the tag doesn't exist, it will be created automatically. Example: `task-master parse-prd spec.txt --tag=new-feature`.

### 2. Parse PRD (`parse_prd`)

*   **MCP Tool:** `parse_prd`
*   **CLI Command:** `task-master parse-prd [file] [options]`
*   **Description:** `Parse a Product Requirements Document, PRD, or text file with Taskmaster to automatically generate an initial set of tasks in tasks.json.`
*   **Key Parameters/Options:**
    *   `input`: `Path to your PRD or requirements text file that Taskmaster should parse for tasks.` (CLI: `[file]` positional or `-i, --input <file>`)
    *   `output`: `Specify where Taskmaster should save the generated 'tasks.json' file. Defaults to '.taskmaster/tasks/tasks.json'.` (CLI: `-o, --output <file>`)
    *   `numTasks`: `Approximate number of top-level tasks Taskmaster should aim to generate from the document.` (CLI: `-n, --num-tasks <number>`)
    *   `force`: `Use this to allow Taskmaster to overwrite an existing 'tasks.json' without asking for confirmation.` (CLI: `-f, --force`)
*   **Usage:** Useful for bootstrapping a project from an existing requirements document.
*   **Notes:** Task Master will strictly adhere to any specific requirements mentioned in the PRD, such as libraries, database schemas, frameworks, tech stacks, etc., while filling in any gaps where the PRD isn't fully specified. Tasks are designed to provide the most direct implementation path while avoiding over-engineering.
*   **Important:** This MCP tool makes AI calls and can take up to a minute to complete. Please inform users to hang tight while the operation is in progress. If the user does not have a PRD, suggest discussing their idea and then use the example PRD in `.taskmaster/templates/example_prd.txt` as a template for creating the PRD based on their idea, for use with `parse-prd`.

---

## AI Model Configuration

### 2. Manage Models (`models`)
*   **MCP Tool:** `models`
*   **CLI Command:** `task-master models [options]`
*   **Description:** `View the current AI model configuration or set specific models for different roles (main, research, fallback). Allows setting custom model IDs for Ollama and OpenRouter.`
*   **Key MCP Parameters/Options:**
    *   `setMain <model_id>`: `Set the primary model ID for task generation/updates.` (CLI: `--set-main <model_id>`)
    *   `setResearch <model_id>`: `Set the model ID for research-backed operations.` (CLI: `--set-research <model_id>`)
    *   `setFallback <model_id>`: `Set the model ID to use if the primary fails.` (CLI: `--set-fallback <model_id>`)
    *   `ollama <boolean>`: `Indicates the set model ID is a custom Ollama model.` (CLI: `--ollama`)
    *   `openrouter <boolean>`: `Indicates the set model ID is a custom OpenRouter model.` (CLI: `--openrouter`)
    *   `listAvailableModels <boolean>`: `If true, lists available models not currently assigned to a role.` (CLI: No direct equivalent; CLI lists available automatically)
    *   `projectRoot <string>`: `Optional. Absolute path to the project root directory.` (CLI: Determined automatically)
*   **Key CLI Options:**
    *   `--set-main <model_id>`: `Set the primary model.`
    *   `--set-research <model_id>`: `Set the research model.`
    *   `--set-fallback <model_id>`: `Set the fallback model.`
    *   `--ollama`: `Specify that the provided model ID is for Ollama (use with --set-*).`
    *   `--openrouter`: `Specify that the provided model ID is for OpenRouter (use with --set-*). Validates against OpenRouter API.`
    *   `--bedrock`: `Specify that the provided model ID is for AWS Bedrock (use with --set-*).`
    *   `--setup`: `Run interactive setup to configure models, including custom Ollama/OpenRouter IDs.`
*   **Usage (MCP):** Call without set flags to get current config. Use `setMain`, `setResearch`, or `setFallback` with a valid model ID to update the configuration. Use `listAvailableModels: true` to get a list of unassigned models. To set a custom model, provide the model ID and set `ollama: true` or `openrouter: true`.
*   **Usage (CLI):** Run without flags to view current configuration and available models. Use set flags to update specific roles. Use `--setup` for guided configuration, including custom models. To set a custom model via flags, use `--set-<role>=<model_id>` along with either `--ollama` or `--openrouter`.
*   **Notes:** Configuration is stored in `.taskmaster/config.json` in the project root. This command/tool modifies that file. Use `listAvailableModels` or `task-master models` to see internally supported models. OpenRouter custom models are validated against their live API. Ollama custom models are not validated live.
*   **API note:** API keys for selected AI providers (based on their model) need to exist in the mcp.json file to be accessible in MCP context. The API keys must be present in the local .env file for the CLI to be able to read them.
*   **Model costs:** The costs in supported models are expressed in dollars. An input/output value of 3 is $3.00. A value of 0.8 is $0.80. 
*   **Warning:** DO NOT MANUALLY EDIT THE .taskmaster/config.json FILE. Use the included commands either in the MCP or CLI format as needed. Always prioritize MCP tools when available and use the CLI as a fallback.

---

## Task Listing & Viewing

### 3. Get Tasks (`get_tasks`)

*   **MCP Tool:** `get_tasks`
*   **CLI Command:** `task-master list [options]`
*   **Description:** `List your Taskmaster tasks, optionally filtering by status and showing subtasks.`
*   **Key Parameters/Options:**
    *   `status`: `Show only Taskmaster tasks matching this status (or multiple statuses, comma-separated), e.g., 'pending' or 'done,in-progress'.` (CLI: `-s, --status <status>`)
    *   `withSubtasks`: `Include subtasks indented under their parent tasks in the list.` (CLI: `--with-subtasks`)
    *   `tag`: `Specify which tag context to list tasks from. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Get an overview of the project status, often used at the start of a work session.

### 4. Get Next Task (`next_task`)

*   **MCP Tool:** `next_task`
*   **CLI Command:** `task-master next [options]`
*   **Description:** `Ask Taskmaster to show the next available task you can work on, based on status and completed dependencies.`
*   **Key Parameters/Options:**
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
    *   `tag`: `Specify which tag context to use. Defaults to the current active tag.` (CLI: `--tag <name>`)
*   **Usage:** Identify what to work on next according to the plan.

### 5. Get Task Details (`get_task`)

*   **MCP Tool:** `get_task`
*   **CLI Command:** `task-master show [id] [options]`
*   **Description:** `Display detailed information for one or more specific Taskmaster tasks or subtasks by ID.`
*   **Key Parameters/Options:**
    *   `id`: `Required. The ID of the Taskmaster task (e.g., '15'), subtask (e.g., '15.2'), or a comma-separated list of IDs ('1,5,10.2') you want to view.` (CLI: `[id]` positional or `-i, --id <id>`)
    *   `tag`: `Specify which tag context to get the task(s) from. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Understand the full details for a specific task. When multiple IDs are provided, a summary table is shown.
*   **CRITICAL INFORMATION** If you need to collect information from multiple tasks, use comma-separated IDs (i.e. 1,2,3) to receive an array of tasks. Do not needlessly get tasks one at a time if you need to get many as that is wasteful.

---

## Task Creation & Modification

### 6. Add Task (`add_task`)

*   **MCP Tool:** `add_task`
*   **CLI Command:** `task-master add-task [options]`
*   **Description:** `Add a new task to Taskmaster by describing it; AI will structure it.`
*   **Key Parameters/Options:**
    *   `prompt`: `Required. Describe the new task you want Taskmaster to create, e.g., "Implement user authentication using JWT".` (CLI: `-p, --prompt <text>`)
    *   `dependencies`: `Specify the IDs of any Taskmaster tasks that must be completed before this new one can start, e.g., '12,14'.` (CLI: `-d, --dependencies <ids>`)
    *   `priority`: `Set the priority for the new task: 'high', 'medium', or 'low'. Default is 'medium'.` (CLI: `--priority <priority>`)
    *   `research`: `Enable Taskmaster to use the research role for potentially more informed task creation.` (CLI: `-r, --research`)
    *   `tag`: `Specify which tag context to add the task to. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Quickly add newly identified tasks during development.
*   **Important:** This MCP tool makes AI calls and can take up to a minute to complete. Please inform users to hang tight while the operation is in progress.

### 7. Add Subtask (`add_subtask`)

*   **MCP Tool:** `add_subtask`
*   **CLI Command:** `task-master add-subtask [options]`
*   **Description:** `Add a new subtask to a Taskmaster parent task, or convert an existing task into a subtask.`
*   **Key Parameters/Options:**
    *   `id` / `parent`: `Required. The ID of the Taskmaster task that will be the parent.` (MCP: `id`, CLI: `-p, --parent <id>`)
    *   `taskId`: `Use this if you want to convert an existing top-level Taskmaster task into a subtask of the specified parent.` (CLI: `-i, --task-id <id>`)
    *   `title`: `Required if not using taskId. The title for the new subtask Taskmaster should create.` (CLI: `-t, --title <title>`)
    *   `description`: `A brief description for the new subtask.` (CLI: `-d, --description <text>`)
    *   `details`: `Provide implementation notes or details for the new subtask.` (CLI: `--details <text>`)
    *   `dependencies`: `Specify IDs of other tasks or subtasks, e.g., '15' or '16.1', that must be done before this new subtask.` (CLI: `--dependencies <ids>`)
    *   `status`: `Set the initial status for the new subtask. Default is 'pending'.` (CLI: `-s, --status <status>`)
    *   `skipGenerate`: `Prevent Taskmaster from automatically regenerating markdown task files after adding the subtask.` (CLI: `--skip-generate`)
    *   `tag`: `Specify which tag context to operate on. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Break down tasks manually or reorganize existing tasks.

### 8. Update Tasks (`update`)

*   **MCP Tool:** `update`
*   **CLI Command:** `task-master update [options]`
*   **Description:** `Update multiple upcoming tasks in Taskmaster based on new context or changes, starting from a specific task ID.`
*   **Key Parameters/Options:**
    *   `from`: `Required. The ID of the first task Taskmaster should update. All tasks with this ID or higher that are not 'done' will be considered.` (CLI: `--from <id>`)
    *   `prompt`: `Required. Explain the change or new context for Taskmaster to apply to the tasks, e.g., "We are now using React Query instead of Redux Toolkit for data fetching".` (CLI: `-p, --prompt <text>`)
    *   `research`: `Enable Taskmaster to use the research role for more informed updates. Requires appropriate API key.` (CLI: `-r, --research`)
    *   `tag`: `Specify which tag context to operate on. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Handle significant implementation changes or pivots that affect multiple future tasks. Example CLI: `task-master update --from='18' --prompt='Switching to React Query.\nNeed to refactor data fetching...'`
*   **Important:** This MCP tool makes AI calls and can take up to a minute to complete. Please inform users to hang tight while the operation is in progress.

### 9. Update Task (`update_task`)

*   **MCP Tool:** `update_task`
*   **CLI Command:** `task-master update-task [options]`
*   **Description:** `Modify a specific Taskmaster task by ID, incorporating new information or changes. By default, this replaces the existing task details.`
*   **Key Parameters/Options:**
    *   `id`: `Required. The specific ID of the Taskmaster task, e.g., '15', you want to update.` (CLI: `-i, --id <id>`)
    *   `prompt`: `Required. Explain the specific changes or provide the new information Taskmaster should incorporate into this task.` (CLI: `-p, --prompt <text>`)
    *   `append`: `If true, appends the prompt content to the task's details with a timestamp, rather than replacing them. Behaves like update-subtask.` (CLI: `--append`)
    *   `research`: `Enable Taskmaster to use the research role for more informed updates. Requires appropriate API key.` (CLI: `-r, --research`)
    *   `tag`: `Specify which tag context the task belongs to. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Refine a specific task based on new understanding. Use `--append` to log progress without creating subtasks.
*   **Important:** This MCP tool makes AI calls and can take up to a minute to complete. Please inform users to hang tight while the operation is in progress.

### 10. Update Subtask (`update_subtask`)

*   **MCP Tool:** `update_subtask`
*   **CLI Command:** `task-master update-subtask [options]`
*   **Description:** `Append timestamped notes or details to a specific Taskmaster subtask without overwriting existing content. Intended for iterative implementation logging.`
*   **Key Parameters/Options:**
    *   `id`: `Required. The ID of the Taskmaster subtask, e.g., '5.2', to update with new information.` (CLI: `-i, --id <id>`)
    *   `prompt`: `Required. The information, findings, or progress notes to append to the subtask's details with a timestamp.` (CLI: `-p, --prompt <text>`)
    *   `research`: `Enable Taskmaster to use the research role for more informed updates. Requires appropriate API key.` (CLI: `-r, --research`)
    *   `tag`: `Specify which tag context the subtask belongs to. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Log implementation progress, findings, and discoveries during subtask development. Each update is timestamped and appended to preserve the implementation journey.
*   **Important:** This MCP tool makes AI calls and can take up to a minute to complete. Please inform users to hang tight while the operation is in progress.

### 11. Set Task Status (`set_task_status`)

*   **MCP Tool:** `set_task_status`
*   **CLI Command:** `task-master set-status [options]`
*   **Description:** `Update the status of one or more Taskmaster tasks or subtasks, e.g., 'pending', 'in-progress', 'done'.`
*   **Key Parameters/Options:**
    *   `id`: `Required. The ID(s) of the Taskmaster task(s) or subtask(s), e.g., '15', '15.2', or '16,17.1', to update.` (CLI: `-i, --id <id>`)
    *   `status`: `Required. The new status to set, e.g., 'done', 'pending', 'in-progress', 'review', 'cancelled'.` (CLI: `-s, --status <status>`)
    *   `tag`: `Specify which tag context to operate on. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Mark progress as tasks move through the development cycle.

### 12. Remove Task (`remove_task`)

*   **MCP Tool:** `remove_task`
*   **CLI Command:** `task-master remove-task [options]`
*   **Description:** `Permanently remove a task or subtask from the Taskmaster tasks list.`
*   **Key Parameters/Options:**
    *   `id`: `Required. The ID of the Taskmaster task, e.g., '5', or subtask, e.g., '5.2', to permanently remove.` (CLI: `-i, --id <id>`)
    *   `yes`: `Skip the confirmation prompt and immediately delete the task.` (CLI: `-y, --yes`)
    *   `tag`: `Specify which tag context to operate on. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Permanently delete tasks or subtasks that are no longer needed in the project.
*   **Notes:** Use with caution as this operation cannot be undone. Consider using 'blocked', 'cancelled', or 'deferred' status instead if you just want to exclude a task from active planning but keep it for reference. The command automatically cleans up dependency references in other tasks.

---

## Task Structure & Breakdown

### 13. Expand Task (`expand_task`)

*   **MCP Tool:** `expand_task`
*   **CLI Command:** `task-master expand [options]`
*   **Description:** `Use Taskmaster's AI to break down a complex task into smaller, manageable subtasks. Appends subtasks by default.`
*   **Key Parameters/Options:**
    *   `id`: `The ID of the specific Taskmaster task you want to break down into subtasks.` (CLI: `-i, --id <id>`)
    *   `num`: `Optional: Suggests how many subtasks Taskmaster should aim to create. Uses complexity analysis/defaults otherwise.` (CLI: `-n, --num <number>`)
    *   `research`: `Enable Taskmaster to use the research role for more informed subtask generation. Requires appropriate API key.` (CLI: `-r, --research`)
    *   `prompt`: `Optional: Provide extra context or specific instructions to Taskmaster for generating the subtasks.` (CLI: `-p, --prompt <text>`)
    *   `force`: `Optional: If true, clear existing subtasks before generating new ones. Default is false (append).` (CLI: `--force`)
    *   `tag`: `Specify which tag context the task belongs to. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Generate a detailed implementation plan for a complex task before starting coding. Automatically uses complexity report recommendations if available and `num` is not specified.
*   **Important:** This MCP tool makes AI calls and can take up to a minute to complete. Please inform users to hang tight while the operation is in progress.

### 14. Expand All Tasks (`expand_all`)

*   **MCP Tool:** `expand_all`
*   **CLI Command:** `task-master expand --all [options]` (Note: CLI uses the `expand` command with the `--all` flag)
*   **Description:** `Tell Taskmaster to automatically expand all eligible pending/in-progress tasks based on complexity analysis or defaults. Appends subtasks by default.`
*   **Key Parameters/Options:**
    *   `num`: `Optional: Suggests how many subtasks Taskmaster should aim to create per task.` (CLI: `-n, --num <number>`)
    *   `research`: `Enable research role for more informed subtask generation. Requires appropriate API key.` (CLI: `-r, --research`)
    *   `prompt`: `Optional: Provide extra context for Taskmaster to apply generally during expansion.` (CLI: `-p, --prompt <text>`)
    *   `force`: `Optional: If true, clear existing subtasks before generating new ones for each eligible task. Default is false (append).` (CLI: `--force`)
    *   `tag`: `Specify which tag context to expand. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Useful after initial task generation or complexity analysis to break down multiple tasks at once.
*   **Important:** This MCP tool makes AI calls and can take up to a minute to complete. Please inform users to hang tight while the operation is in progress.

### 15. Clear Subtasks (`clear_subtasks`)

*   **MCP Tool:** `clear_subtasks`
*   **CLI Command:** `task-master clear-subtasks [options]`
*   **Description:** `Remove all subtasks from one or more specified Taskmaster parent tasks.`
*   **Key Parameters/Options:**
    *   `id`: `The ID(s) of the Taskmaster parent task(s) whose subtasks you want to remove, e.g., '15' or '16,18'. Required unless using `all`.) (CLI: `-i, --id <ids>`)
    *   `all`: `Tell Taskmaster to remove subtasks from all parent tasks.` (CLI: `--all`)
    *   `tag`: `Specify which tag context to operate on. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Used before regenerating subtasks with `expand_task` if the previous breakdown needs replacement.

### 16. Remove Subtask (`remove_subtask`)

*   **MCP Tool:** `remove_subtask`
*   **CLI Command:** `task-master remove-subtask [options]`
*   **Description:** `Remove a subtask from its Taskmaster parent, optionally converting it into a standalone task.`
*   **Key Parameters/Options:**
    *   `id`: `Required. The ID(s) of the Taskmaster subtask(s) to remove, e.g., '15.2' or '16.1,16.3'.` (CLI: `-i, --id <id>`)
    *   `convert`: `If used, Taskmaster will turn the subtask into a regular top-level task instead of deleting it.` (CLI: `-c, --convert`)
    *   `skipGenerate`: `Prevent Taskmaster from automatically regenerating markdown task files after removing the subtask.` (CLI: `--skip-generate`)
    *   `tag`: `Specify which tag context to operate on. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Delete unnecessary subtasks or promote a subtask to a top-level task.

### 17. Move Task (`move_task`)

*   **MCP Tool:** `move_task`
*   **CLI Command:** `task-master move [options]`
*   **Description:** `Move a task or subtask to a new position within the task hierarchy.`
*   **Key Parameters/Options:**
    *   `from`: `Required. ID of the task/subtask to move (e.g., "5" or "5.2"). Can be comma-separated for multiple tasks.` (CLI: `--from <id>`)
    *   `to`: `Required. ID of the destination (e.g., "7" or "7.3"). Must match the number of source IDs if comma-separated.` (CLI: `--to <id>`)
    *   `tag`: `Specify which tag context to operate on. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Reorganize tasks by moving them within the hierarchy. Supports various scenarios like:
    *   Moving a task to become a subtask
    *   Moving a subtask to become a standalone task
    *   Moving a subtask to a different parent
    *   Reordering subtasks within the same parent
    *   Moving a task to a new, non-existent ID (automatically creates placeholders)
    *   Moving multiple tasks at once with comma-separated IDs
*   **Validation Features:**
    *   Allows moving tasks to non-existent destination IDs (creates placeholder tasks)
    *   Prevents moving to existing task IDs that already have content (to avoid overwriting)
    *   Validates that source tasks exist before attempting to move them
    *   Maintains proper parent-child relationships
*   **Example CLI:** `task-master move --from=5.2 --to=7.3` to move subtask 5.2 to become subtask 7.3.
*   **Example Multi-Move:** `task-master move --from=10,11,12 --to=16,17,18` to move multiple tasks to new positions.
*   **Common Use:** Resolving merge conflicts in tasks.json when multiple team members create tasks on different branches.

---

## Dependency Management

### 18. Add Dependency (`add_dependency`)

*   **MCP Tool:** `add_dependency`
*   **CLI Command:** `task-master add-dependency [options]`
*   **Description:** `Define a dependency in Taskmaster, making one task a prerequisite for another.`
*   **Key Parameters/Options:**
    *   `id`: `Required. The ID of the Taskmaster task that will depend on another.` (CLI: `-i, --id <id>`)
    *   `dependsOn`: `Required. The ID of the Taskmaster task that must be completed first, the prerequisite.` (CLI: `-d, --depends-on <id>`)
    *   `tag`: `Specify which tag context to operate on. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <path>`)
*   **Usage:** Establish the correct order of execution between tasks.

### 19. Remove Dependency (`remove_dependency`)

*   **MCP Tool:** `remove_dependency`
*   **CLI Command:** `task-master remove-dependency [options]`
*   **Description:** `Remove a dependency relationship between two Taskmaster tasks.`
*   **Key Parameters/Options:**
    *   `id`: `Required. The ID of the Taskmaster task you want to remove a prerequisite from.` (CLI: `-i, --id <id>`)
    *   `dependsOn`: `Required. The ID of the Taskmaster task that should no longer be a prerequisite.` (CLI: `-d, --depends-on <id>`)
    *   `tag`: `Specify which tag context to operate on. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Update task relationships when the order of execution changes.

### 20. Validate Dependencies (`validate_dependencies`)

*   **MCP Tool:** `validate_dependencies`
*   **CLI Command:** `task-master validate-dependencies [options]`
*   **Description:** `Check your Taskmaster tasks for dependency issues (like circular references or links to non-existent tasks) without making changes.`
*   **Key Parameters/Options:**
    *   `tag`: `Specify which tag context to validate. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Audit the integrity of your task dependencies.

### 21. Fix Dependencies (`fix_dependencies`)

*   **MCP Tool:** `fix_dependencies`
*   **CLI Command:** `task-master fix-dependencies [options]`
*   **Description:** `Automatically fix dependency issues (like circular references or links to non-existent tasks) in your Taskmaster tasks.`
*   **Key Parameters/Options:**
    *   `tag`: `Specify which tag context to fix dependencies in. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Clean up dependency errors automatically.

---

## Analysis & Reporting

### 22. Analyze Project Complexity (`analyze_project_complexity`)

*   **MCP Tool:** `analyze_project_complexity`
*   **CLI Command:** `task-master analyze-complexity [options]`
*   **Description:** `Have Taskmaster analyze your tasks to determine their complexity and suggest which ones need to be broken down further.`
*   **Key Parameters/Options:**
    *   `output`: `Where to save the complexity analysis report. Default is '.taskmaster/reports/task-complexity-report.json' (or '..._tagname.json' if a tag is used).` (CLI: `-o, --output <file>`)
    *   `threshold`: `The minimum complexity score (1-10) that should trigger a recommendation to expand a task.` (CLI: `-t, --threshold <number>`)
    *   `research`: `Enable research role for more accurate complexity analysis. Requires appropriate API key.` (CLI: `-r, --research`)
    *   `tag`: `Specify which tag context to analyze. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Used before breaking down tasks to identify which ones need the most attention.
*   **Important:** This MCP tool makes AI calls and can take up to a minute to complete. Please inform users to hang tight while the operation is in progress.

### 23. View Complexity Report (`complexity_report`)

*   **MCP Tool:** `complexity_report`
*   **CLI Command:** `task-master complexity-report [options]`
*   **Description:** `Display the task complexity analysis report in a readable format.`
*   **Key Parameters/Options:**
    *   `tag`: `Specify which tag context to show the report for. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to the complexity report (default: '.taskmaster/reports/task-complexity-report.json').` (CLI: `-f, --file <file>`)
*   **Usage:** Review and understand the complexity analysis results after running analyze-complexity.

---

## File Management

### 24. Generate Task Files (`generate`)

*   **MCP Tool:** `generate`
*   **CLI Command:** `task-master generate [options]`
*   **Description:** `Create or update individual Markdown files for each task based on your tasks.json.`
*   **Key Parameters/Options:**
    *   `output`: `The directory where Taskmaster should save the task files (default: in a 'tasks' directory).` (CLI: `-o, --output <directory>`)
    *   `tag`: `Specify which tag context to generate files for. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
*   **Usage:** Run this after making changes to tasks.json to keep individual task files up to date. This command is now manual and no longer runs automatically.

---

## AI-Powered Research

### 25. Research (`research`)

*   **MCP Tool:** `research`
*   **CLI Command:** `task-master research [options]`
*   **Description:** `Perform AI-powered research queries with project context to get fresh, up-to-date information beyond the AI's knowledge cutoff.`
*   **Key Parameters/Options:**
    *   `query`: `Required. Research query/prompt (e.g., "What are the latest best practices for React Query v5?").` (CLI: `[query]` positional or `-q, --query <text>`)
    *   `taskIds`: `Comma-separated list of task/subtask IDs from the current tag context (e.g., "15,16.2,17").` (CLI: `-i, --id <ids>`)
    *   `filePaths`: `Comma-separated list of file paths for context (e.g., "src/api.js,docs/readme.md").` (CLI: `-f, --files <paths>`)
    *   `customContext`: `Additional custom context text to include in the research.` (CLI: `-c, --context <text>`)
    *   `includeProjectTree`: `Include project file tree structure in context (default: false).` (CLI: `--tree`)
    *   `detailLevel`: `Detail level for the research response: 'low', 'medium', 'high' (default: medium).` (CLI: `--detail <level>`)
    *   `saveTo`: `Task or subtask ID (e.g., "15", "15.2") to automatically save the research conversation to.` (CLI: `--save-to <id>`)
    *   `saveFile`: `If true, saves the research conversation to a markdown file in '.taskmaster/docs/research/'.` (CLI: `--save-file`)
    *   `noFollowup`: `Disables the interactive follow-up question menu in the CLI.` (CLI: `--no-followup`)
    *   `tag`: `Specify which tag context to use for task-based context gathering. Defaults to the current active tag.` (CLI: `--tag <name>`)
    *   `projectRoot`: `The directory of the project. Must be an absolute path.` (CLI: Determined automatically)
*   **Usage:** **This is a POWERFUL tool that agents should use FREQUENTLY** to:
    *   Get fresh information beyond knowledge cutoff dates
    *   Research latest best practices, library updates, security patches
    *   Find implementation examples for specific technologies
    *   Validate approaches against current industry standards
    *   Get contextual advice based on project files and tasks
*   **When to Consider Using Research:**
    *   **Before implementing any task** - Research current best practices
    *   **When encountering new technologies** - Get up-to-date implementation guidance (libraries, apis, etc)
    *   **For security-related tasks** - Find latest security recommendations
    *   **When updating dependencies** - Research breaking changes and migration guides
    *   **For performance optimization** - Get current performance best practices
    *   **When debugging complex issues** - Research known solutions and workarounds
*   **Research + Action Pattern:**
    *   Use `research` to gather fresh information
    *   Use `update_subtask` to commit findings with timestamps
    *   Use `update_task` to incorporate research into task details
    *   Use `add_task` with research flag for informed task creation
*   **Important:** This MCP tool makes AI calls and can take up to a minute to complete. The research provides FRESH data beyond the AI's training cutoff, making it invaluable for current best practices and recent developments.

---

## Tag Management

This new suite of commands allows you to manage different task contexts (tags).

### 26. List Tags (`tags`)

*   **MCP Tool:** `list_tags`
*   **CLI Command:** `task-master tags [options]`
*   **Description:** `List all available tags with task counts, completion status, and other metadata.`
*   **Key Parameters/Options:**
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)
    *   `--show-metadata`: `Include detailed metadata in the output (e.g., creation date, description).` (CLI: `--show-metadata`)

### 27. Add Tag (`add_tag`)

*   **MCP Tool:** `add_tag`
*   **CLI Command:** `task-master add-tag <tagName> [options]`
*   **Description:** `Create a new, empty tag context, or copy tasks from another tag.`
*   **Key Parameters/Options:**
    *   `tagName`: `Name of the new tag to create (alphanumeric, hyphens, underscores).` (CLI: `<tagName>` positional)
    *   `--from-branch`: `Creates a tag with a name derived from the current git branch, ignoring the <tagName> argument.` (CLI: `--from-branch`)
    *   `--copy-from-current`: `Copy tasks from the currently active tag to the new tag.` (CLI: `--copy-from-current`)
    *   `--copy-from <tag>`: `Copy tasks from a specific source tag to the new tag.` (CLI: `--copy-from <tag>`)
    *   `--description <text>`: `Provide an optional description for the new tag.` (CLI: `-d, --description <text>`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)

### 28. Delete Tag (`delete_tag`)

*   **MCP Tool:** `delete_tag`
*   **CLI Command:** `task-master delete-tag <tagName> [options]`
*   **Description:** `Permanently delete a tag and all of its associated tasks.`
*   **Key Parameters/Options:**
    *   `tagName`: `Name of the tag to delete.` (CLI: `<tagName>` positional)
    *   `--yes`: `Skip the confirmation prompt.` (CLI: `-y, --yes`)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)

### 29. Use Tag (`use_tag`)

*   **MCP Tool:** `use_tag`
*   **CLI Command:** `task-master use-tag <tagName>`
*   **Description:** `Switch your active task context to a different tag.`
*   **Key Parameters/Options:**
    *   `tagName`: `Name of the tag to switch to.` (CLI: `<tagName>` positional)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)

### 30. Rename Tag (`rename_tag`)

*   **MCP Tool:** `rename_tag`
*   **CLI Command:** `task-master rename-tag <oldName> <newName>`
*   **Description:** `Rename an existing tag.`
*   **Key Parameters/Options:**
    *   `oldName`: `The current name of the tag.` (CLI: `<oldName>` positional)
    *   `newName`: `The new name for the tag.` (CLI: `<newName>` positional)
    *   `file`: `Path to your Taskmaster 'tasks.json' file. Default relies on auto-detection.` (CLI: `-f, --file <file>`)

### 31. Copy Tag (`copy_tag`)

*   **MCP Tool:** `copy_tag`
*   **CLI Command:** `task-master copy-tag <sourceName> <targetName> [options]`
*   **Description:** `Copy an entire tag context, including all its tasks and metadata, to a new tag.`
*   **Key Parameters/Options:**
    *   `sourceName`: `Name of the tag to copy from.` (CLI: `<sourceName>` positional)
    *   `targetName`: `Name of the new tag to create.` (CLI: `<targetName>` positional)
    *   `--description <text>`: `Optional description for the new tag.` (CLI: `-d, --description <text>`)

---

## Miscellaneous

### 32. Sync Readme (`sync-readme`) -- experimental

*   **MCP Tool:** N/A
*   **CLI Command:** `task-master sync-readme [options]`
*   **Description:** `Exports your task list to your project's README.md file, useful for showcasing progress.`
*   **Key Parameters/Options:**
    *   `status`: `Filter tasks by status (e.g., 'pending', 'done').` (CLI: `-s, --status <status>`)
    *   `withSubtasks`: `Include subtasks in the export.` (CLI: `--with-subtasks`)
    *   `tag`: `Specify which tag context to export from. Defaults to the current active tag.` (CLI: `--tag <name>`)

---

## Environment Variables Configuration (Updated)

Taskmaster primarily uses the **`.taskmaster/config.json`** file (in project root) for configuration (models, parameters, logging level, etc.), managed via `task-master models --setup`.

Environment variables are used **only** for sensitive API keys related to AI providers and specific overrides like the Ollama base URL:

*   **API Keys (Required for corresponding provider):**
    *   `ANTHROPIC_API_KEY`
    *   `PERPLEXITY_API_KEY`
    *   `OPENAI_API_KEY`
    *   `GOOGLE_API_KEY`
    *   `MISTRAL_API_KEY`
    *   `AZURE_OPENAI_API_KEY` (Requires `AZURE_OPENAI_ENDPOINT` too)
    *   `OPENROUTER_API_KEY`
    *   `XAI_API_KEY`
    *   `OLLAMA_API_KEY` (Requires `OLLAMA_BASE_URL` too)
*   **Endpoints (Optional/Provider Specific inside .taskmaster/config.json):**
    *   `AZURE_OPENAI_ENDPOINT`
    *   `OLLAMA_BASE_URL` (Default: `http://localhost:11434/api`)

**Set API keys** in your **`.env`** file in the project root (for CLI use) or within the `env` section of your **`.trae/mcp.json`** file (for MCP/Trae integration). All other settings (model choice, max tokens, temperature, log level, custom endpoints) are managed in `.taskmaster/config.json` via `task-master models` command or `models` MCP tool.

---

For details on how these commands fit into the development process, see the [dev_workflow.md](.trae/rules/dev_workflow.md).