# Task Master Loop - Default Task Completion

You are completing tasks from a Task Master backlog. Complete ONE task per session.

## Files Available

- @.taskmaster/tasks/tasks.json - Your task backlog
- @.taskmaster/loop-progress.txt - Progress log from previous iterations

## Process

1. Run `task-master next` to get the highest priority available task
2. Read the task details carefully with `task-master show <id>`
3. Implement the task, focusing on the smallest possible change
4. Ensure quality:
   - Run tests if they exist
   - Run type check if applicable
   - Verify the implementation works as expected
5. Update the task status: `task-master set-status --id=<id> --status=done`
6. Commit your work with a descriptive message referencing the task ID
7. Append a brief note to the progress file about what was done

## Important

- Complete ONLY ONE task per session
- Keep changes small and focused
- Do NOT start another task after completing one
- If all tasks are complete, output: <loop-complete>ALL_TASKS_DONE</loop-complete>
- If you cannot complete the task, output: <loop-blocked>REASON</loop-blocked>
