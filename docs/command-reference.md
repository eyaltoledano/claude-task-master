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

# View multiple tasks with comma-separated IDs
task-master show 1,3,5
task-master show 44,55

# View a specific subtask (e.g., subtask 2 of task 1)
task-master show 1.2

# Mix parent tasks and subtasks
task-master show 44,44.1,55,55.2
```

**Multiple Task Display:**

- **Single ID**: Shows detailed task view with full implementation details
- **Multiple IDs**: Shows compact summary table with interactive action menu
- **Action Menu**: Provides copy-paste ready commands for batch operations:
  - Mark all as in-progress/done
  - Show next available task
  - Expand all tasks (generate subtasks)
  - View dependency relationships
  - Generate task files

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
```

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

## Research Fresh Information

```bash
# Perform AI-powered research with fresh, up-to-date information
task-master research "What are the latest best practices for JWT authentication in Node.js?"

# Research with specific task context
task-master research "How to implement OAuth 2.0?" --id=15,16

# Research with file context for code-aware suggestions
task-master research "How can I optimize this API implementation?" --files=src/api.js,src/auth.js

# Research with custom context and project tree
task-master research "Best practices for error handling" --context="We're using Express.js" --tree

# Research with different detail levels
task-master research "React Query v5 migration guide" --detail=high

# Save research results to a file
task-master research "Database optimization techniques" --save=research/db-optimization.md
```

**The research command is a powerful tool that provides:**

- **Fresh information beyond AI knowledge cutoffs**
- **Project-aware context** from your tasks and files
- **Automatic task discovery** using fuzzy search
- **Multiple detail levels** (low, medium, high)
- **Token counting and cost tracking**
- **Interactive follow-up questions**

**Use research frequently to:**

- Get current best practices before implementing features
- Research new technologies and libraries
- Find solutions to complex problems
- Validate your implementation approaches
- Stay updated with latest security recommendations
