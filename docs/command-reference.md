# Task Master Command Reference

Here's a comprehensive reference of all available commands:

## Parse PRD

```bash
# Parse a PRD file and generate tasks
task-master parse-prd <prd-file.txt>

# Limit the number of tasks generated
task-master parse-prd <prd-file.txt> --num-tasks=10
```

## List Tasks

```bash
# List all tasks
task-master list

# List tasks with a specific status
task-master list --status=<status>

# List tasks with subtasks
task-master list --with-subtasks

# List tasks with a specific status and include subtasks
task-master list --status=<status> --with-subtasks
```

## Show Next Task

```bash
# Show the next task to work on based on dependencies and status
task-master next
```

## Show Specific Task

```bash
# Show details of a specific task
task-master show <id>
# or
task-master show --id=<id>

# View a specific subtask (e.g., subtask 2 of task 1)
task-master show 1.2
```

## Update Tasks

```bash
# Update tasks from a specific ID and provide context
task-master update --from=<id> --prompt="<prompt>"

# Update tasks using research role
task-master update --from=<id> --prompt="<prompt>" --research
```

## Update a Specific Task

```bash
# Update a single task by ID with new information
task-master update-task --id=<id> --prompt="<prompt>"

# Use research-backed updates
task-master update-task --id=<id> --prompt="<prompt>" --research
```

## Update a Subtask

```bash
# Append additional information to a specific subtask
task-master update-subtask --id=<parentId.subtaskId> --prompt="<prompt>"

# Example: Add details about API rate limiting to subtask 2 of task 5
task-master update-subtask --id=5.2 --prompt="Add rate limiting of 100 requests per minute"

# Use research-backed updates
task-master update-subtask --id=<parentId.subtaskId> --prompt="<prompt>" --research
```

Unlike the `update-task` command which replaces task information, the `update-subtask` command _appends_ new information to the existing subtask details, marking it with a timestamp. This is useful for iteratively enhancing subtasks while preserving the original content.

## Generate Task Files

```bash
# Generate individual task files from tasks.json
task-master generate
```

## Set Task Status

```bash
# Set status of a single task
task-master set-status --id=<id> --status=<status>

# Set status for multiple tasks
task-master set-status --id=1,2,3 --status=<status>

# Set status for subtasks
task-master set-status --id=1.1,1.2 --status=<status>
```

When marking a task as "done", all of its subtasks will automatically be marked as "done" as well.

## Expand Tasks

```bash
# Expand a specific task with subtasks
task-master expand --id=<id> --num=<number>

# Expand with additional context
task-master expand --id=<id> --prompt="<context>"

# Expand all pending tasks
task-master expand --all

# Force regeneration of subtasks for tasks that already have them
task-master expand --all --force

# Research-backed subtask generation for a specific task
task-master expand --id=<id> --research

# Research-backed generation for all tasks
task-master expand --all --research
```

## Clear Subtasks

```bash
# Clear subtasks from a specific task
task-master clear-subtasks --id=<id>

# Clear subtasks from multiple tasks
task-master clear-subtasks --id=1,2,3

# Clear subtasks from all tasks
task-master clear-subtasks --all
```

## Analyze Task Complexity

```bash
# Analyze complexity of all tasks
task-master analyze-complexity

# Save report to a custom location
task-master analyze-complexity --output=my-report.json

# Use a specific LLM model
task-master analyze-complexity --model=claude-3-opus-20240229

# Set a custom complexity threshold (1-10)
task-master analyze-complexity --threshold=6

# Use an alternative tasks file
task-master analyze-complexity --file=custom-tasks.json

# Use Perplexity AI for research-backed complexity analysis
task-master analyze-complexity --research
```

## View Complexity Report

```bash
# Display the task complexity analysis report
task-master complexity-report

# View a report at a custom location
task-master complexity-report --file=my-report.json
```

## Managing Task Dependencies

```bash
# Add a dependency to a task
task-master add-dependency --id=<id> --depends-on=<id>

# Remove a dependency from a task
task-master remove-dependency --id=<id> --depends-on=<id>

# Validate dependencies without fixing them
task-master validate-dependencies

# Find and fix invalid dependencies automatically
task-master fix-dependencies
```

## Move Tasks

```bash
# Move a task or subtask to a new position
task-master move --from=<id> --to=<id>

# Examples:
# Move task to become a subtask
task-master move --from=5 --to=7

# Move subtask to become a standalone task
task-master move --from=5.2 --to=7

# Move subtask to a different parent
task-master move --from=5.2 --to=7.3

# Reorder subtasks within the same parent
task-master move --from=5.2 --to=5.4

# Move a task to a new ID position (creates placeholder if doesn't exist)
task-master move --from=5 --to=25

# Move multiple tasks at once (must have the same number of IDs)
task-master move --from=10,11,12 --to=16,17,18
```

## Add a New Task

```bash
# Add a new task using AI (main role)
task-master add-task --prompt="Description of the new task"

# Add a new task using AI (research role)
task-master add-task --prompt="Description of the new task" --research

# Add a task with dependencies
task-master add-task --prompt="Description" --dependencies=1,2,3

# Add a task with priority
task-master add-task --prompt="Description" --priority=high
```

## Initialize a Project

```bash
# Initialize a new project with Task Master structure
task-master init

# Initialize a new project applying specific rules
task-master init --rules cursor,windsurf,vscode
```

- The `--rules` flag allows you to specify one or more rule profiles (e.g., `cursor`, `roo`, `windsurf`, `cline`) to apply during initialization.
- If omitted, all available rule profiles are installed by default (claude, cline, codex, cursor, roo, trae, vscode, windsurf).
- You can use multiple comma-separated profiles in a single command.

## Manage Rules

```bash
# Add rule profiles to your project
# (e.g., .roo/rules, .windsurf/rules)
task-master rules add <profile1,profile2,...>

# Remove rule sets from your project
task-master rules remove <profile1,profile2,...>

# Remove rule sets bypassing safety check (dangerous)
task-master rules remove <profile1,profile2,...> --force

# Launch interactive rules setup to select rules
# (does not re-initialize project or ask about shell aliases)
task-master rules setup
```

- Adding rules creates the profile and rules directory (e.g., `.roo/rules`) and copies/initializes the rules.
- Removing rules deletes the profile and rules directory and associated MCP config.
- **Safety Check**: Attempting to remove rule profiles will trigger a critical warning requiring confirmation. Use `--force` to bypass.
- You can use multiple comma-separated rules in a single command.
- The `setup` action launches an interactive prompt to select which rules to apply. The list of rules is always current with the available profiles, and no manual updates are needed. This command does **not** re-initialize your project or affect shell aliases; it only manages rules interactively.

**Examples:**

```bash
task-master rules add windsurf,roo,vscode
task-master rules remove windsurf
task-master rules setup
```

### Interactive Rules Setup

You can launch the interactive rules setup at any time with:

```bash
task-master rules setup
```

This command opens a prompt where you can select which rule profiles (e.g., Cursor, Roo, Windsurf) you want to add to your project. This does **not** re-initialize your project or ask about shell aliases; it only manages rules.

- Use this command to add rule profiles interactively after project creation.
- The same interactive prompt is also used during `init` if you don't specify rules with `--rules`.

## Configure AI Models

```bash
# View current AI model configuration and API key status
task-master models

# Set the primary model for generation/updates (provider inferred if known)
task-master models --set-main=claude-3-opus-20240229

# Set the research model
task-master models --set-research=sonar-pro

# Set the fallback model
task-master models --set-fallback=claude-3-haiku-20240307

# Set a custom Ollama model for the main role
task-master models --set-main=my-local-llama --ollama

# Set a custom OpenRouter model for the research role
task-master models --set-research=google/gemini-pro --openrouter

# Run interactive setup to configure models, including custom ones
task-master models --setup
```

Configuration is stored in `.taskmasterconfig` in your project root. API keys are still managed via `.env` or MCP configuration. Use `task-master models` without flags to see available built-in models. Use `--setup` for a guided experience.
