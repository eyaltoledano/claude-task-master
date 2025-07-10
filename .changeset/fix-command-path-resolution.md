---
"task-master-ai": patch
---

Fix path resolution and context gathering errors across multiple commands

- Fixed parse-prd command requiring tasks.json to exist before creating it
- Fixed analyze-complexity command requiring report file to exist before creating it  
- Removed default values from CLI option definitions for both commands
- Commands now only include file paths in initTaskMaster when explicitly specified by users
- Added null handling for output paths with fallback to default locations
- Fixed gatheredContext parameter type errors across all commands (was passing object instead of string):
  - analyze-task-complexity.js
  - expand-task.js
  - update-task-by-id.js
  - update-subtask-by-id.js
  - update-tasks.js
- Fixed prompt variant error in analyze-complexity (was trying to load non-existent 'research' variant)
- Resolves initialization flow issues where commands couldn't create files they were designed to generate