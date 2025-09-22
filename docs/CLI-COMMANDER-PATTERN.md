# CLI Commander Class Pattern

## Overview
We're using Commander.js's native class pattern instead of custom abstractions. This is cleaner, more maintainable, and uses the framework as designed.

## Architecture

```
@tm/core (Business Logic)          @tm/cli (Presentation)
┌─────────────────────┐            ┌──────────────────────────┐
│ TaskMasterCore      │◄───────────│ ListTasksCommand         │
│ - getTaskList()     │            │ extends Commander.Command│
│ - getTask()         │            │ - display logic only     │
│ - getNextTask()     │            │ - formatting             │
└─────────────────────┘            └──────────────────────────┘
         ▲                                      ▲
         │                                      │
         └──────── Gets Data ──────────────────┘
                                     Displays Data
```

## Implementation

### Command Class Pattern

```typescript
// apps/cli/src/commands/list-tasks-commander.ts
export class ListTasksCommand extends Command {
  constructor(name?: string) {
    super(name || 'list');
    
    this
      .description('List tasks')
      .option('-s, --status <status>', 'Filter by status')
      .action(async (options) => {
        // 1. Get data from @tm/core
        const result = await this.tmCore.getTaskList(options);
        
        // 2. Display data (presentation only)
        this.displayResults(result, options);
      });
  }
}
```

### Main CLI Class

```typescript
// apps/cli/src/cli-commander.ts
class TaskMasterCLI extends Command {
  createCommand(name?: string): Command {
    switch (name) {
      case 'list':
        return new ListTasksCommand(name);
      default:
        return new Command(name);
    }
  }
}
```

## Integration with Existing Scripts

### Gradual Migration Path

```javascript
// scripts/modules/commands.js

// OLD WAY (keep working during migration)
program
  .command('old-list')
  .action(async (options) => {
    await listTasksV2(...);
  });

// NEW WAY (add alongside old)
import { ListTasksCommand } from '@tm/cli';
program.addCommand(new ListTasksCommand());
```

### Benefits

1. **No Custom Abstractions**: Using Commander.js as designed
2. **Clean Separation**: Business logic in core, presentation in CLI
3. **Gradual Migration**: Can migrate one command at a time
4. **Type Safety**: Full TypeScript support with Commander types
5. **Framework Native**: Better documentation, examples, and community support

## Migration Steps

1. **Phase 1**: Build command classes in @tm/cli (current)
2. **Phase 2**: Import in scripts/modules/commands.js
3. **Phase 3**: Replace old implementations one by one
4. **Phase 4**: Remove old code when all migrated

## Example Usage

### In New Code
```javascript
import { ListTasksCommand } from '@tm/cli';
const program = new Command();
program.addCommand(new ListTasksCommand());
```

### In Existing Scripts
```javascript
// Gradual adoption
const listCmd = new ListTasksCommand();
program.addCommand(listCmd);
```

### Programmatic Usage
```javascript
const listCommand = new ListTasksCommand();
await listCommand.parseAsync(['node', 'script', '--format', 'json']);
```

## POC Status

✅ **Completed**:
- ListTasksCommand extends Commander.Command
- Clean separation of concerns
- Integration examples
- Build configuration

🚧 **Next Steps**:
- Migrate more commands
- Update existing scripts to use new classes
- Remove old implementations gradually

This POC proves the pattern works and provides a clean migration path!