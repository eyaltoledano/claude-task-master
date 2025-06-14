# Task Master Command Reference

Comprehensive command structure for Task Master integration with Claude Code.

## Command Organization

Commands are organized hierarchically to match Task Master's CLI structure while providing enhanced Claude Code integration.

## Project Setup & Configuration

### `/project:tm/init`
- `index` - Initialize new project (handles PRD files intelligently)
- `quick` - Quick setup with auto-confirmation (-y flag)

### `/project:tm/models`
- `index` - View current AI model configuration
- `setup` - Interactive model configuration
- `set-main` - Set primary generation model
- `set-research` - Set research model
- `set-fallback` - Set fallback model

## Task Generation

### `/project:tm/parse-prd`
- `index` - Generate tasks from PRD document
- `with-research` - Enhanced parsing with research mode

### `/project:tm/generate`
- Create individual task files from tasks.json

## Task Management

### `/project:tm/list`
- `index` - Smart listing with natural language filters
- `with-subtasks` - Include subtasks in hierarchical view
- `by-status` - Filter by specific status

### `/project:tm/set-status`
- `to-pending` - Reset task to pending
- `to-in-progress` - Start working on task
- `to-done` - Mark task complete
- `to-review` - Submit for review
- `to-deferred` - Defer task
- `to-cancelled` - Cancel task

### `/project:tm/sync-readme`
- Export tasks to README.md with formatting

### `/project:tm/update`
- `index` - Update tasks with natural language
- `from-id` - Update multiple tasks from a starting point
- `single` - Update specific task

### `/project:tm/add-task`
- `index` - Add new task with AI assistance

### `/project:tm/remove-task`
- `index` - Remove task with confirmation

## Subtask Management

### `/project:tm/add-subtask`
- `index` - Add new subtask to parent
- `from-task` - Convert existing task to subtask

### `/project:tm/remove-subtask`
- Remove subtask (with optional conversion)

### `/project:tm/clear-subtasks`
- `index` - Clear subtasks from specific task
- `all` - Clear all subtasks globally

## Task Analysis & Breakdown

### `/project:tm/analyze-complexity`
- Analyze and generate expansion recommendations

### `/project:tm/complexity-report`
- Display complexity analysis report

### `/project:tm/expand`
- `index` - Break down specific task
- `all` - Expand all eligible tasks
- `with-research` - Enhanced expansion

## Task Navigation

### `/project:tm/next`
- Intelligent next task recommendation

### `/project:tm/show`
- Display detailed task information

### `/project:tm/status`
- Comprehensive project dashboard

## Dependency Management

### `/project:tm/add-dependency`
- Add task dependency

### `/project:tm/remove-dependency`
- Remove task dependency

### `/project:tm/validate-dependencies`
- Check for dependency issues

### `/project:tm/fix-dependencies`
- Automatically fix dependency problems

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