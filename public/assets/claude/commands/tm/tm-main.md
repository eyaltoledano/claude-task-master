# Task Master Command Reference

Comprehensive command structure for Task Master integration with Claude Code.

## Command Organization

Commands are organized hierarchically to match Task Master's CLI structure while providing enhanced Claude Code integration.

## Project Setup & Configuration

### `/project:tm/init`
- `init-project` - Initialize new project (handles PRD files intelligently)
- `init-project-quick` - Quick setup with auto-confirmation (-y flag)

### `/project:tm/models`
- `view-models` - View current AI model configuration
- `setup-models` - Interactive model configuration
- `set-main` - Set primary generation model
- `set-research` - Set research model
- `set-fallback` - Set fallback model

## Task Generation

### `/project:tm/parse-prd`
- `parse-prd` - Generate tasks from PRD document
- `parse-prd-with-research` - Enhanced parsing with research mode

### `/project:tm/generate`
- `generate-tasks` - Create individual task files from tasks.json

## Task Management

### `/project:tm/list`
- `list-tasks` - Smart listing with natural language filters
- `list-tasks-with-subtasks` - Include subtasks in hierarchical view
- `list-tasks-by-status` - Filter by specific status

### `/project:tm/set-status`
- `to-pending` - Reset task to pending
- `to-in-progress` - Start working on task
- `to-done` - Mark task complete
- `to-review` - Submit for review
- `to-deferred` - Defer task
- `to-cancelled` - Cancel task

### `/project:tm/sync-readme`
- `sync-readme` - Export tasks to README.md with formatting

### `/project:tm/update`
- `update-task` - Update tasks with natural language
- `update-tasks-from-id` - Update multiple tasks from a starting point
- `update-single-task` - Update specific task

### `/project:tm/add-task`
- `add-task` - Add new task with AI assistance

### `/project:tm/remove-task`
- `remove-task` - Remove task with confirmation

## Subtask Management

### `/project:tm/add-subtask`
- `add-subtask` - Add new subtask to parent
- `convert-task-to-subtask` - Convert existing task to subtask

### `/project:tm/remove-subtask`
- `remove-subtask` - Remove subtask (with optional conversion)

### `/project:tm/clear-subtasks`
- `clear-subtasks` - Clear subtasks from specific task
- `clear-all-subtasks` - Clear all subtasks globally

## Task Analysis & Breakdown

### `/project:tm/analyze-complexity`
- `analyze-complexity` - Analyze and generate expansion recommendations

### `/project:tm/complexity-report`
- `complexity-report` - Display complexity analysis report

### `/project:tm/expand`
- `expand-task` - Break down specific task
- `expand-all-tasks` - Expand all eligible tasks
- `with-research` - Enhanced expansion

## Task Navigation

### `/project:tm/next`
- `next-task` - Intelligent next task recommendation

### `/project:tm/show`
- `show-task` - Display detailed task information

### `/project:tm/status`
- `project-status` - Comprehensive project dashboard

## Dependency Management

### `/project:tm/add-dependency`
- `add-dependency` - Add task dependency

### `/project:tm/remove-dependency`
- `remove-dependency` - Remove task dependency

### `/project:tm/validate-dependencies`
- `validate-dependencies` - Check for dependency issues

### `/project:tm/fix-dependencies`
- `fix-dependencies` - Automatically fix dependency problems

## Workflows & Automation

### `/project:tm/workflows`
- `smart-workflow` - Context-aware intelligent workflow execution
- `command-pipeline` - Chain multiple commands together
- `auto-implement-tasks` - Advanced auto-implementation with code generation

## Utilities

### `/project:tm/utils`
- `analyze-project` - Deep project analysis and insights

### `/project:tm/setup`
- `install-taskmaster` - Comprehensive installation guide
- `quick-install-taskmaster` - One-line global installation

## Usage Patterns

### Natural Language
Most commands accept natural language arguments:
```
/project:tm/add-task create user authentication system
/project:tm/update mark all API tasks as high priority
/project:tm/list show blocked tasks
```

### ID-Based Commands
Commands requiring IDs intelligently parse from $ARGUMENTS:
```
/project:tm/show 45
/project:tm/expand 23
/project:tm/set-status/to-done 67
```

### Smart Defaults
Commands provide intelligent defaults and suggestions based on context.