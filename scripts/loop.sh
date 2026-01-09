#!/bin/bash
# Keeping here for reference, but using the new task-master loop command instead
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# Cold start check - test if sandbox auth is ready
echo "Checking sandbox auth..."
test_result=$(docker sandbox run claude -p "Say OK" 2>&1) || true

if [[ "$test_result" == *"OK"* ]]; then
  echo "✓ Sandbox ready"
else
  echo "Sandbox needs authentication. Starting interactive session..."
  echo "Please complete auth, then ctrl+c to continue."
  echo ""
  docker sandbox run claude "cool you're in! you can now exit (ctrl + c) so we can continue the loop"
  echo ""
  echo "✓ Auth complete"
fi
echo ""

for ((i=1; i<=$1; i++)); do
  echo ""
  echo "━━━ Iteration $i of $1 ━━━"

  result=$(docker sandbox run claude -p "@.taskmaster/tasks/tasks.json @.taskmaster/loop-progress.txt @CLAUDE.md \
SETUP: If task-master command not found, run: npm i -g task-master-ai \
\
TASK: Implement ONE task/subtask for the tm loop feature. \
\
PROCESS: \
1. Run task-master next (or use MCP) to get the next available task/subtask. \
2. Read task details with task-master show <id>. \
3. Implement following codebase patterns (CLI in apps/cli/src/commands/, core in packages/tm-core/src/modules/). \
4. Write tests alongside implementation. \
5. Run npm run turbo:typecheck to verify types. \
6. Run npm test -w <package> to verify tests pass. \
7. Mark complete: task-master set-status --id=<id> --status=done \
8. Commit with message: feat(loop): <what was implemented> (do NOT include loop-progress.txt in commit) \
9. Append super-concise notes to .taskmaster/loop-progress.txt: task ID, what was done, any learnings. \
\
IMPORTANT: \
- Complete ONLY ONE task per iteration. \
- Keep changes small and focused. \
- Do NOT start another task after completing one. \
- If all tasks are done, output <loop-complete>ALL_DONE</loop-complete>. \
- If blocked, output <loop-blocked>REASON</loop-blocked>. \
")

  echo "$result"

  # Strict match - require exact format with content
  if [[ "$result" =~ \<loop-complete\>ALL_DONE\</loop-complete\> ]]; then
    echo ""
    echo "All tasks complete after $i iterations."
    exit 0
  fi

  if [[ "$result" =~ \<loop-blocked\>.+\</loop-blocked\> ]]; then
    echo ""
    echo "Blocked at iteration $i."
    exit 1
  fi
done

echo "Max iterations ($1) reached."
