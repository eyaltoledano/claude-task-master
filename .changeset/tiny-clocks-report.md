---
"task-master-ai": minor
---

Add loop command for automated task execution with Claude Code

**New Features:**
- `task-master loop` command that runs Claude Code in a Docker sandbox, executing one task per iteration based on the selected tag
- Built-in presets for different workflows:
  - `default` - General task completion from the Task Master backlog
  - `test-coverage` - Find uncovered code and write meaningful tests
  - `linting` - Fix lint errors and type errors one by one
  - `duplication` - Find duplicated code and refactor into shared utilities
  - `entropy` - Find code smells and clean them up
- Progress file tracking to maintain context across iterations (inside `.taskmaster/loop-progress.txt`)
  - Remember to delete this file between loops to not pollute the agent with bad context
- Automatic completion detection via `<loop-complete>` and `<loop-blocked>` markers
