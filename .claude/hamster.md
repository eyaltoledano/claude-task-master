# Hamster Integration Workflow

This guide outlines the process for working with tasks imported from Hamster briefs using Task Master. When connected to a Hamster brief, follow these specific guidelines to ensure proper task management and workflow execution.

## Command Restrictions

### Supported Commands
Use only these Task Master CLI commands when working with Hamster briefs:
```bash
tm list                      # List all tasks
tm show <sub/task id> --json # Show task details (--json saves tokens)
tm set-status                # Update task status
tm auth refresh              # Refresh authentication token
tm context <brief url>       # Reconnect to Hamster brief context
```

### Unsupported Commands
- Do not use MCP tools when connected with Hamster briefs - they are not yet up to date with Hamster integration
- Do not use other Task Master CLI commands that haven't been verified to work with Hamster integration

## Task Workflow Process

### Starting a Task
```bash
# Mark task and subtasks as in-progress when starting
tm set-status -i 1,1.1 -s in-progress

# Multiple tasks/subtasks can be marked at once using comma separation
tm set-status -i 1,1.1,1.2,2 -s in-progress
```

### Task Implementation Flow
1. **Read the Task**: Use `tm show <id> --json` to understand the task requirements
2. **Check for Subtasks**: If the task has subtasks, implement them one at a time
3. **Implement Subtask**: Complete the subtask implementation
4. **Verify Quality**: Run lint and typecheck before marking as done
   ```bash
   npm run lint
   npm run typecheck
   ```
5. **Mark Complete**: If verification passes, mark the subtask as done
   ```bash
   tm set-status -i 1.1 -s done
   ```
6. **Commit Changes**: Commit the completed subtask work
7. **Repeat**: Continue until all subtasks are complete

### Parent Task Completion
- After all subtasks are done, run final verification:
  ```bash
  npm run lint
  npm run typecheck
  ```
- Mark the parent task as done:
  ```bash
  tm set-status -i 1 -s done
  ```
- Move to the next task and repeat the process

## Multiple Task Context

### Viewing Multiple Tasks
```bash
# Use comma-separated IDs to get context from multiple tasks
tm show 1,1.1,2,2.1 --json

# This is more efficient than calling tm show multiple times
```

### Parallel Subtask Execution
- **When to Parallelize**: If a task has subtasks that can be completed in parallel
- **Requirements**:
  - Ensure work/files to adjust are **not the same** across subtasks
  - Spawn sub-agents for each parallel subtask
  - Verify clear separation of work before parallelizing
- **Example**: If subtask 1.1 modifies `src/api.js` and subtask 1.2 modifies `src/utils.js`, these can run in parallel

## Pull Request Management

### PR Creation Strategy
- **Preferred Approach**: Keep everything in one PR if scope remains manageable
- **When to Split**: Create separate PRs if the work becomes too large
- **Multi-PR Strategy**: If splitting is necessary:
  - Create PRs that build on top of previous ones
  - **Always confirm with the human** before creating multiple PRs
- **PR Creation**: Use GitHub CLI after completing a task:
  ```bash
  gh pr create --title "Task X: [Task Title]" --body "Description"
  ```

### Committing to PRs
- Keep committing to the same PR as long as the scope is maintained
- An entire task list (brief) might fit into a single PR
- If scope grows too large, discuss with human before creating new PRs

## Authentication & Context Management

### Token Refresh
```bash
# Refresh token if JWT seems expired or commands don't work
tm auth refresh

# If refresh doesn't work, reconnect context
tm context <brief url>
```

### Context Reconnection
- **When Needed**: If commands stop working or authentication fails
- **Required Information**: Brief URL (ask user if not available)
- **Best Practice**: Store brief URL at the beginning of the session
- **Command**: `tm context <brief url>`

## Integration with Git Workflow

When working with Hamster briefs, follow standard Git workflow patterns:
- Create task-specific branches: `task-XXX`
- Commit subtask work incrementally
- Create PRs after task completion
- Follow commit message standards

## Key Principles

- **Incremental Progress**: Work through subtasks one at a time
- **Quality Gates**: Always run lint and typecheck before marking tasks as done
- **Clear Communication**: Confirm with human before splitting work across multiple PRs
- **Efficient Context Gathering**: Use comma-separated IDs when viewing multiple tasks
- **Authentication Management**: Proactively refresh tokens and reconnect context when needed
