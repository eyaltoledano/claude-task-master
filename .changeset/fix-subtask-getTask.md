---
"task-master-ai": patch
---

Fixed issue where `tm show` command could not find subtasks using dotted notation IDs (e.g., '8.1'). 

- The command now properly searches within parent task subtasks and returns the correct subtask information.