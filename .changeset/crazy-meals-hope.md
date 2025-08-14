---
"task-master-ai": minor
---

Add cross-tag task movement functionality for organizing tasks across different contexts.

This feature enables moving tasks between different tags (contexts) in your project, making it easier to organize work across different branches, environments, or project phases.

## CLI Usage Examples

Move a single task from one tag to another:
```bash
# Move task 5 from backlog tag to in-progress tag
task-master move --from=5 --from-tag=backlog --to-tag=feature-1

# Move task with its dependencies
task-master move --from=5 --from-tag=backlog --to-tag=feature-2 --with-dependencies

# Move task without checking dependencies
task-master move --from=5 --from-tag=backlog --to-tag=bug-3 --ignore-dependencies
```

Move multiple tasks at once:
```bash
# Move multiple tasks between tags
task-master move --from=5,6,7 --from-tag=backlog --to-tag=bug-4 --with-dependencies
```
