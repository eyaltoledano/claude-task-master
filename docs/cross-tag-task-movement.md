# Cross-Tag Task Movement

Task Master now supports moving tasks between different tag contexts, allowing you to organize your work across multiple project contexts, feature branches, or development phases.

## Overview

Cross-tag task movement enables you to:
- Move tasks between different tag contexts (e.g., from "backlog" to "in-progress")
- Handle cross-tag dependencies intelligently
- Maintain task relationships across different contexts
- Organize work across multiple project phases

## Basic Usage

### Within-Tag Moves

Move tasks within the same tag context:

```bash
# Move a single task
task-master move --from=5 --to=7

# Move a subtask
task-master move --from=5.2 --to=7.3

# Move multiple tasks
task-master move --from=5,6,7 --to=10,11,12
```

### Cross-Tag Moves

Move tasks between different tag contexts:

```bash
# Basic cross-tag move
task-master move --from=5 --from-tag=backlog --to-tag=in-progress

# Move multiple tasks
task-master move --from=5,6,7 --from-tag=backlog --to-tag=done
```

## Dependency Resolution

When moving tasks between tags, you may encounter cross-tag dependencies. Task Master provides several options to handle these:

### Move with Dependencies

Move the main task along with all its dependent tasks:

```bash
task-master move --from=5 --from-tag=backlog --to-tag=in-progress --with-dependencies
```

This ensures that all dependent tasks are moved together, maintaining the task relationships.

### Break Dependencies

Break cross-tag dependencies and move only the specified task:

```bash
task-master move --from=5 --from-tag=backlog --to-tag=in-progress --ignore-dependencies
```

This removes the dependency relationships and moves only the specified task.

### Force Move

Note: Force moves are no longer supported. Instead, use one of these options:

- `--with-dependencies` — move dependents together
- `--ignore-dependencies` — break cross-tag dependencies

⚠️ **Warning**: This may break dependency relationships and should be used with caution.

## Error Handling

Task Master provides enhanced error messages with specific resolution suggestions:

### Cross-Tag Dependency Conflicts

When you encounter dependency conflicts, you'll see:

```text
❌ Cannot move tasks from "backlog" to "in-progress"

Cross-tag dependency conflicts detected:
  • Task 5 depends on 2 (in backlog)
  • Task 6 depends on 3 (in done)

Resolution options:
  1. Move with dependencies: task-master move --from=5,6 --from-tag=backlog --to-tag=in-progress --with-dependencies
  2. Break dependencies: task-master move --from=5,6 --from-tag=backlog --to-tag=in-progress --ignore-dependencies
  3. Validate and fix dependencies: task-master validate-dependencies && task-master fix-dependencies
  4. Move dependencies first: task-master move --from=2,3 --from-tag=backlog --to-tag=in-progress
  5. After deciding, re-run the move with either --with-dependencies or --ignore-dependencies
```

### Subtask Movement Restrictions

Subtasks cannot be moved directly between tags:

```text
❌ Cannot move subtask 5.2 directly between tags

Subtask movement restriction:
  • Subtasks cannot be moved directly between tags
  • They must be promoted to full tasks first

Resolution options:
  1. Promote subtask to full task: task-master remove-subtask --id=5.2 --convert
  2. Then move the promoted task: task-master move --from=5 --from-tag=backlog --to-tag=in-progress
  3. Or move the parent task with all subtasks: task-master move --from=5 --from-tag=backlog --to-tag=in-progress --with-dependencies
```

### Invalid Tag Combinations

When source and target tags are the same:

```text
❌ Invalid tag combination

Error details:
  • Source tag: "backlog"
  • Target tag: "backlog"
  • Reason: Source and target tags are identical

Resolution options:
  1. Use different tags for cross-tag moves
  2. Use within-tag move: task-master move --from=<id> --to=<id> --tag=backlog
  3. Check available tags: task-master tags
```

## Best Practices

### 1. Check Dependencies First

Before moving tasks, validate your dependencies:

```bash
# Check for dependency issues
task-master validate-dependencies

# Fix common dependency problems
task-master fix-dependencies
```

### 2. Use Appropriate Flags

- **`--with-dependencies`**: When you want to maintain task relationships
- **`--ignore-dependencies`**: When you want to break cross-tag dependencies

### 3. Organize by Context

Use tags to organize work by:
- **Development phases**: `backlog`, `in-progress`, `review`, `done`
- **Feature branches**: `feature-auth`, `feature-dashboard`
- **Team members**: `alice-tasks`, `bob-tasks`
- **Project versions**: `v1.0`, `v2.0`

### 4. Handle Subtasks Properly

For subtasks, either:
1. Promote the subtask to a full task first
2. Move the parent task with all subtasks using `--with-dependencies`

## Advanced Usage

### Multiple Task Movement

Move multiple tasks at once:

```bash
# Move multiple tasks with dependencies
task-master move --from=5,6,7 --from-tag=backlog --to-tag=in-progress --with-dependencies

# Move multiple tasks, breaking dependencies
task-master move --from=5,6,7 --from-tag=backlog --to-tag=in-progress --ignore-dependencies
```

### Tag Creation

Target tags are created automatically if they don't exist:

```bash
# This will create the "new-feature" tag if it doesn't exist
task-master move --from=5 --from-tag=backlog --to-tag=new-feature
```

### Current Tag Fallback

If `--from-tag` is not provided, the current tag is used:

```bash
# Uses current tag as source
task-master move --from=5 --to-tag=in-progress
```

## MCP Integration

The cross-tag move functionality is also available through MCP tools:

```javascript
// Move task with dependencies
await moveTask({
  from: "5",
  fromTag: "backlog", 
  toTag: "in-progress",
  withDependencies: true
});

// Break dependencies
await moveTask({
  from: "5",
  fromTag: "backlog",
  toTag: "in-progress", 
  ignoreDependencies: true
});
```

## Troubleshooting

### Common Issues

1. **"Source tag not found"**: Check available tags with `task-master tags`
2. **"Task not found"**: Verify task IDs with `task-master list`
3. **"Cross-tag dependency conflicts"**: Use dependency resolution flags
4. **"Cannot move subtask"**: Promote subtask first or move parent task

### Getting Help

```bash
# Show move command help
task-master move --help

# Check available tags
task-master tags

# Validate dependencies
task-master validate-dependencies

# Fix dependency issues
task-master fix-dependencies
```

## Examples

### Scenario 1: Moving from Backlog to In-Progress

```bash
# Check for dependencies first
task-master validate-dependencies

# Move with dependencies
task-master move --from=5 --from-tag=backlog --to-tag=in-progress --with-dependencies
```

### Scenario 2: Breaking Dependencies

```bash
# Move task, breaking cross-tag dependencies
task-master move --from=5 --from-tag=backlog --to-tag=done --ignore-dependencies
```

### Scenario 3: Force Move

Choose one of these options explicitly:

```bash
# Move together with dependencies
task-master move --from=5 --from-tag=backlog --to-tag=in-progress --with-dependencies

# Or break dependencies
task-master move --from=5 --from-tag=backlog --to-tag=in-progress --ignore-dependencies
```

### Scenario 4: Moving Subtasks

```bash
# Option 1: Promote subtask first
task-master remove-subtask --id=5.2 --convert
task-master move --from=5 --from-tag=backlog --to-tag=in-progress

# Option 2: Move parent with all subtasks
task-master move --from=5 --from-tag=backlog --to-tag=in-progress --with-dependencies
```
