---
'task-master-ai': patch
---

Improves next command to be subtask-aware
    - The logic for determining the "next task" (findNextTask function, used by task-master next and the next_task MCP tool) has been significantly improved. Previously, it only considered top-level tasks, making its recommendation less useful when a parent task containing subtasks was already marked 'in-progress'.
    - The updated logic now prioritizes finding the next available subtask within any 'in-progress' parent task, considering subtask dependencies and priority. 
    - If no suitable subtask is found within active parent tasks, it falls back to recommending the next eligible top-level task based on the original criteria (status, dependencies, priority). 
    
This change makes the next command much more relevant and helpful during the implementation phase of complex tasks.
