# Hamster (Go ham!) Run Task Workflow

This command initiates the HAM (Hamster Automated Management) workflow for task execution.

## Usage

```
/go:ham [task-id]
```

- `task-id` (optional): Specific task identifier to work on (e.g., "1", "1.2", "2.3.1")
  - If provided, start working on that specific task immediately
  - If omitted, automatically identify the next available task

## Process

When the user invokes this command, follow these steps:

### 1. Task Selection

#### If task-id is provided ($ARGUMENTS is not empty):
```bash
tm show $ARGUMENTS
```
Start working on the specified task immediately, skipping to step 3.

#### If no task-id is provided ($ARGUMENTS is empty):
```bash
tm list
```
Display all tasks with their current status to provide context.

### 2. Identify Next Task (only if no task-id provided)
Determine which task should be worked on next based on:
- Dependencies
- Priority
- Current status (pending tasks only)

### 3. Show Task Details (only if task wasn't specified in step 1)
```bash
tm show <task-id>
```
Display the full details of the identified task including:
- Title and description
- Dependencies
- Test strategy
- Subtasks (if any)

### 4. Kickoff Workflow

Based on the task type, follow the appropriate workflow:

#### For Main Tasks (e.g., "1", "2", "3")
- Review the task's subtasks
- If no subtasks exist, suggest expanding the task first
- Identify the first pending subtask
- Begin implementation following the subtask's requirements

#### For Subtasks (e.g., "1.1", "2.3")
- Mark the subtask as in-progress:
  ```bash
  tm set-status --id=<subtask-id> --status=in-progress
  ```
- Review the task details and requirements
- Check for related code files or dependencies
- Create an implementation plan
- Begin implementation following project conventions

### 5. Implementation Guidelines

Follow these principles during implementation:

1. **Understand First**: Read related files and understand the current architecture
2. **Plan**: Create a mental model or brief plan before coding
3. **Follow Conventions**: Adhere to project structure and coding standards
4. **Test As You Go**: Validate changes incrementally
5. **Stay Focused**: Complete the current subtask before moving to the next

### 6. Task Completion

When the subtask is complete:
```bash
tm set-status --id=<subtask-id> --status=done
```

Then automatically check for the next available task by repeating from step 2.

## Example Flows

### With Specific Task ID
```
User: "/go:ham 1.2"

1. Claude runs: tm show 1.2
   → Displays full task details
2. Claude analyzes the task and creates an implementation plan
3. Claude marks task in-progress: tm set-status --id=1.2 --status=in-progress
4. Claude begins implementation following the task requirements
5. Upon completion, Claude runs: tm set-status --id=1.2 --status=done
6. Claude automatically identifies next task with tm list
```

### Without Specific Task ID (Auto-discovery)
```
User: "/go:ham"

1. Claude runs: tm list
2. Claude identifies next available task (e.g., 1.2)
3. Claude runs: tm show 1.2
   → Displays full task details
4. Claude analyzes the task and creates an implementation plan
5. Claude marks task in-progress: tm set-status --id=1.2 --status=in-progress
6. Claude begins implementation following the task requirements
7. Upon completion, Claude runs: tm set-status --id=1.2 --status=done
8. Claude automatically identifies next task with tm list
```

## Notes

- Always verify task dependencies are complete before starting
- If a task is blocked, mark it as such and move to the next available task
- Keep the user informed of progress at each major step
- Ask for clarification if task requirements are unclear
- Follow the project's CLAUDE.md and .cursor/rules/* guidelines at all times
- Unlike the usual Taskmaster process, do not bother using update-task nor update-subtask as they do not work with Hamster tasks yet.

- Use only `tm list`, `tm show <sub/task id>` and `tm set status` - other commands don't yet work with it.
- Do not use the MCP tools when connected with Hamster briefs - that is not yet up to date.
- Use `.cursor/rules/git_workflow.mdc` as a guide for the workflow
- When starting a task, mark it as in-progress. You can mark multiple task statuses at once with comma separation (i.e. `tm set-status -i 1,1.1 -s in-progress`)
- Read the task, then if it has subtasks, begin implementing the subtasks one at a time.
- When the subtask is done, run lint and typecheck, mark the task as done if it passes, and commit.
- Continue until all subtasks are done, then run a final lint and typecheck (`npm lint` and `npm typecheck`) and create a PR using `gh` cli for that Task.
- Keep committing to the same PR as long as the scope is maintained. An entire task list (brief) might fit into a single PR but not if it ends up being huge. It is preferred for everything to land in one PR if it is possible, otherwise commit to different PRs that build on top of the previous ones. Confirm with the human when doing this.
- When the parent task is completed, ensure you mark is as done.
- When the first task is done, repeat this process for all tasks until all tasks are done.
- If you run into an issue where the JWT seems expired or commands don't work, ensure you use `tm auth refresh` to refresh the token and if that does not work, use `tm context <brief url>` to reconnect the context. If you do not have the brief url, ask the user for it (perhaps use it at the beginning)

You're a fast hamster. Go go go.