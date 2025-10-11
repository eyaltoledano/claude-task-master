# Task Master Command Reference

Comprehensive command structure for Task Master integration with Claude Code.

## Command Organization

Commands are organized hierarchically to match Task Master's CLI structure while providing enhanced Claude Code integration.

## Project Setup & Configuration

### `/task-master-ai:init`
- `init-project` - Initialize new project (handles PRD files intelligently)
- `init-project-quick` - Quick setup with auto-confirmation (-y flag)

### `/task-master-ai:models`
- `view-models` - View current AI model configuration
- `setup-models` - Interactive model configuration
- `set-main` - Set primary generation model
- `set-research` - Set research model
- `set-fallback` - Set fallback model

## Task Generation

### `/task-master-ai:parse-prd`
- `parse-prd` - Generate tasks from PRD document
- `parse-prd-with-research` - Enhanced parsing with research mode

### `/task-master-ai:generate`
- `generate-tasks` - Create individual task files from tasks.json

## Task Management

### `/task-master-ai:list`
- `list-tasks` - Smart listing with natural language filters
- `list-tasks-with-subtasks` - Include subtasks in hierarchical view
- `list-tasks-by-status` - Filter by specific status

### `/task-master-ai:set-status`
- `to-pending` - Reset task to pending
- `to-in-progress` - Start working on task
- `to-done` - Mark task complete
- `to-review` - Submit for review
- `to-deferred` - Defer task
- `to-cancelled` - Cancel task

### `/task-master-ai:sync-readme`
- `sync-readme` - Export tasks to README.md with formatting

### `/task-master-ai:update`
- `update-task` - Update tasks with natural language
- `update-tasks-from-id` - Update multiple tasks from a starting point
- `update-single-task` - Update specific task

### `/task-master-ai:add-task`
- `add-task` - Add new task with AI assistance

### `/task-master-ai:remove-task`
- `remove-task` - Remove task with confirmation

## Subtask Management

### `/task-master-ai:add-subtask`
- `add-subtask` - Add new subtask to parent
- `convert-task-to-subtask` - Convert existing task to subtask

### `/task-master-ai:remove-subtask`
- `remove-subtask` - Remove subtask (with optional conversion)

### `/task-master-ai:clear-subtasks`
- `clear-subtasks` - Clear subtasks from specific task
- `clear-all-subtasks` - Clear all subtasks globally

## Task Analysis & Breakdown

### `/task-master-ai:analyze-complexity`
- `analyze-complexity` - Analyze and generate expansion recommendations

### `/task-master-ai:complexity-report`
- `complexity-report` - Display complexity analysis report

### `/task-master-ai:expand`
- `expand-task` - Break down specific task
- `expand-all-tasks` - Expand all eligible tasks
- `with-research` - Enhanced expansion

## Task Navigation

### `/task-master-ai:next`
- `next-task` - Intelligent next task recommendation

### `/task-master-ai:show`
- `show-task` - Display detailed task information

### `/task-master-ai:status`
- `project-status` - Comprehensive project dashboard

## Dependency Management

### `/task-master-ai:add-dependency`
- `add-dependency` - Add task dependency

### `/task-master-ai:remove-dependency`
- `remove-dependency` - Remove task dependency

### `/task-master-ai:validate-dependencies`
- `validate-dependencies` - Check for dependency issues

### `/task-master-ai:fix-dependencies`
- `fix-dependencies` - Automatically fix dependency problems

## Workflows & Automation

### `/task-master-ai:workflows`
- `smart-workflow` - Context-aware intelligent workflow execution
- `command-pipeline` - Chain multiple commands together
- `auto-implement-tasks` - Advanced auto-implementation with code generation

## Utilities

### `/task-master-ai:utils`
- `analyze-project` - Deep project analysis and insights

### `/task-master-ai:setup`
- `install-taskmaster` - Comprehensive installation guide
- `quick-install-taskmaster` - One-line global installation

## Usage Patterns

### Natural Language
Most commands accept natural language arguments:
```
/task-master-ai:add-task create user authentication system
/task-master-ai:update mark all API tasks as high priority
/task-master-ai:list show blocked tasks
```

### ID-Based Commands
Commands requiring IDs intelligently parse from $ARGUMENTS:
```
/task-master-ai:show 45
/task-master-ai:expand 23
/task-master-ai:set-status/to-done 67
```

### Smart Defaults
Commands provide intelligent defaults and suggestions based on context.