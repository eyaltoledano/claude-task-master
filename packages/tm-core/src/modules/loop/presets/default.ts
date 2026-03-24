/**
 * Default preset for Taskmaster loop - general task completion
 * Matches the structure of scripts/loop.sh prompt
 */
export const DEFAULT_PRESET = `SETUP: If task-master command not found, run: npm i -g task-master-ai

TASK: Implement ONE task/subtask from the Taskmaster backlog.

PROCESS:
1. Run task-master next (or use MCP) to get the next available task/subtask.
2. Read task details with task-master show <id>.
3. Implement following codebase patterns.
4. Write tests alongside implementation.
5. Run type check (e.g., \`npm run typecheck\`, \`tsc --noEmit\`).
6. Run tests (e.g., \`npm test\`, \`npm run test\`).
7. Mark complete: task-master set-status --id=<id> --status=done
8. Commit with message: feat(<scope>): <what was implemented>
9. Append super-concise notes to progress file: task ID, what was done, any learnings.

IMPORTANT:
- Complete ONLY ONE task per iteration.
- Keep changes small and focused.
- Do NOT start another task after completing one.
- If all tasks are done, output <loop-complete>ALL_DONE</loop-complete>.
- If blocked, output <loop-blocked>REASON</loop-blocked>.
`;
