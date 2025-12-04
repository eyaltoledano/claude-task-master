---
name: taskmaster-workflow
description: Task Master development workflow for AI agents using Cortex Code. Use when managing tasks, following the task-driven development loop (list → next → show → expand → implement → update-subtask → set-status), or needing guidance on task-based project management.
---

# Task Master Development Workflow

Guide for using Task Master to manage software development projects with Cortex Code.

## MCP Setup for Cortex Code

Add the Task Master MCP server:

```bash
cortex mcp add task-master-ai npx --args="-y,task-master-ai" --env="ANTHROPIC_API_KEY=your_key"
```

Verify with `/mcp-status` during a Cortex Code session.

## The Basic Development Loop

1. **`get_tasks`** - Show what needs to be done
2. **`next_task`** - Decide what to work on
3. **`get_task`** - Get task details
4. **`expand_task`** - Break down complex tasks into subtasks
5. **Implement** - Write code and tests
6. **`update_subtask`** - Log progress and findings
7. **`set_task_status`** - Mark tasks as `done`
8. **Repeat**

## Standard Workflow Process

### Project Initialization

```bash
# Initialize Task Master
task-master init

# Create PRD, then parse it to generate tasks
task-master parse-prd .taskmaster/docs/prd.md

# Analyze complexity and expand tasks
task-master analyze-complexity --research
task-master expand --all --research
```

### Daily Development Loop

```bash
# Start each session
task-master next                    # Find next available task
task-master show <id>               # Review task details

# During implementation
task-master update-subtask --id=<id> --prompt="implementation notes..."

# Complete tasks
task-master set-status --id=<id> --status=done
```

## Task Complexity Analysis

- Run `analyze_project_complexity` for comprehensive analysis
- Review report via `complexity_report`
- Focus on tasks with complexity scores 8-10 for detailed breakdown
- Reports are automatically used by `expand_task`

## Task Breakdown Process

Use `expand_task` to break down complex tasks:
- Automatically uses complexity report if found
- `--num=<number>` specifies explicit subtask count
- `--research` enables research-backed expansion
- `--force` clears existing subtasks first
- `--prompt="<context>"` adds additional context

Expand multiple tasks: `task-master expand --all --research`

## Iterative Subtask Implementation

### 1. Understand the Goal
Use `get_task` to understand subtask requirements.

### 2. Plan Implementation
Explore codebase, identify files and functions to modify.

### 3. Log the Plan
```bash
task-master update-subtask --id=<subtaskId> --prompt='<detailed plan>'
```
Include file paths, proposed changes, reasoning, and challenges.

### 4. Begin Implementation
```bash
task-master set-status --id=<subtaskId> --status=in-progress
```

### 5. Log Progress Regularly
```bash
task-master update-subtask --id=<subtaskId> --prompt='
- What worked...
- What didn'\''t work...'
```

### 6. Complete the Task
```bash
task-master set-status --id=<subtaskId> --status=done
```

## Implementation Drift Handling

When implementation differs from plan:
- `update` - Update multiple future tasks from a specific ID
- `update_task` - Update a single specific task

```bash
task-master update --from=<id> --prompt='<explanation>' --research
```

## Task Status Values

- `pending` - Ready to work on
- `in-progress` - Currently being worked on
- `done` - Completed and verified
- `deferred` - Postponed
- `cancelled` - No longer needed
- `blocked` - Waiting on external factors

## Tagged Task Lists

Task Master supports tagged task lists for multi-context management:
- Maintain separate lists for features, branches, or experiments
- Default tag is "master"
- Use `--tag <name>` with most commands

### When to Use Tags

**Git Feature Branching**: Create tag matching branch name
```bash
task-master add-tag --from-branch
```

**Experiments**: Sandbox risky work
```bash
task-master add-tag experiment-xyz --description="Testing new approach"
```

**Team Collaboration**: Isolate your work context
```bash
task-master add-tag my-work --copy-from-current
```

### Tag Commands

- `task-master tags` - List all tags
- `task-master add-tag <name>` - Create new tag
- `task-master use-tag <name>` - Switch to tag
- `task-master delete-tag <name>` - Remove tag

## Project Structure

```
project/
├── .taskmaster/
│   ├── tasks/
│   │   ├── tasks.json      # Main task database
│   │   └── task-*.md       # Individual task files
│   ├── docs/
│   │   └── prd.md          # Product requirements
│   ├── reports/
│   │   └── task-complexity-report.json
│   └── config.json         # AI models & settings
└── .env                    # API keys for CLI
```

## Configuration

Configure AI models:
```bash
task-master models --setup
```

Set specific models:
```bash
task-master models --set-main claude-sonnet-4-20250514
task-master models --set-research sonar-pro
task-master models --set-fallback gpt-4o-mini
```

## Task Structure

### Task ID Format
- Main tasks: `1`, `2`, `3`
- Subtasks: `1.1`, `1.2`, `2.1`
- Sub-subtasks: `1.1.1`, `1.1.2`

### Task Fields
- **id**: Unique identifier
- **title**: Brief, descriptive title
- **description**: Concise summary
- **status**: Current state
- **priority**: high/medium/low
- **dependencies**: IDs of prerequisite tasks
- **details**: Implementation instructions
- **testStrategy**: Verification approach
- **subtasks**: List of smaller tasks

## AI-Powered Operations

These operations make AI calls and may take up to a minute:
- `parse_prd` - Generate tasks from PRD
- `analyze_project_complexity` - Analyze task complexity
- `expand_task` / `expand_all` - Break down tasks
- `add_task` - Create new task
- `update` / `update_task` / `update_subtask` - Update tasks

## Important Notes

- Never manually edit `tasks.json` - use commands instead
- Never manually edit `.taskmaster/config.json` - use `task-master models`
- Task markdown files are auto-generated
- Use `--research` flag for research-backed AI operations



