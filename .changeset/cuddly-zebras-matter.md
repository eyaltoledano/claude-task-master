---
'task-master-ai': minor
---

feat(expand): Enhance `expand` and `expand-all` commands

- Integrate `task-complexity-report.json` to automatically determine the number of subtasks and use tailored prompts for expansion based on prior analysis. You no longer need to try copy-pasting the recommended prompt. If it exists, it will use it for you. You can just run `task-master update --id=[id of task] --research` and it will use that prompt automatically. No extra prompt needed. 
- Change default behavior to *append* new subtasks to existing ones. Use the `--force` flag to clear existing subtasks before expanding. This is helpful if you need to add more subtasks to a task but you want to do it by the batch from a given prompt. Use force if you want to start fresh with a task's subtasks.
