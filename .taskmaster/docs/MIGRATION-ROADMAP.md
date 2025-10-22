# Task Master Migration Roadmap

## Overview
Gradual migration from scripts-based architecture to a clean monorepo with separated concerns.

## Architecture Vision

```
┌─────────────────────────────────────────────────┐
│                  User Interfaces                 │
├──────────┬──────────┬──────────┬────────────────┤
│  @tm/cli │ @tm/mcp  │ @tm/ext  │  @tm/web      │
│  (CLI)   │  (MCP)   │  (VSCode)│  (Future)     │
└──────────┴──────────┴──────────┴────────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │      @tm/core        │
        │  (Business Logic)    │
        └──────────────────────┘
```

## Migration Phases

### Phase 1: Core Extraction ✅ (In Progress)
**Goal**: Move all business logic to @tm/core

- [x] Create @tm/core package structure
- [x] Move types and interfaces
- [x] Implement TaskMasterCore facade
- [x] Move storage adapters
- [x] Move task services
- [ ] Move AI providers
- [ ] Move parser logic
- [ ] Complete test coverage

### Phase 2: CLI Package Creation 🚧 (Started)
**Goal**: Create @tm/cli as a thin presentation layer

- [x] Create @tm/cli package structure
- [x] Implement Command interface pattern
- [x] Create CommandRegistry
- [x] Build legacy bridge/adapter
- [x] Migrate list-tasks command
- [ ] Migrate remaining commands one by one
- [ ] Remove UI logic from core

### Phase 3: Transitional Integration
**Goal**: Use new packages in existing scripts without breaking changes

```javascript
// scripts/modules/commands.js gradually adopts new commands
import { ListTasksCommand } from '@tm/cli';
const listCommand = new ListTasksCommand();

// Old interface remains the same
programInstance
  .command('list')
  .action(async (options) => {
    // Use new command internally
    const result = await listCommand.execute(convertOptions(options));
  });
```

### Phase 4: MCP Package
**Goal**: Separate MCP server as its own package

- [ ] Create @tm/mcp package
- [ ] Move MCP server code
- [ ] Use @tm/core for all logic
- [ ] MCP becomes a thin RPC layer

### Phase 5: Complete Migration
**Goal**: Remove old scripts, pure monorepo

- [ ] All commands migrated to @tm/cli
- [ ] Remove scripts/modules/task-manager/*
- [ ] Remove scripts/modules/commands.js
- [ ] Update bin/task-master.js to use @tm/cli
- [ ] Clean up dependencies

## Current Transitional Strategy

### 1. Adapter Pattern (commands-adapter.js)
```javascript
// Checks if new CLI is available and uses it
// Falls back to legacy implementation if not
export async function listTasksAdapter(...args) {
  if (cliAvailable) {
    return useNewImplementation(...args);
  }
  return useLegacyImplementation(...args);
}
```

### 2. Command Bridge Pattern
```javascript
// Allows new commands to work in old code
const bridge = new CommandBridge(new ListTasksCommand());
const data = await bridge.run(legacyOptions); // Legacy style
const result = await bridge.execute(newOptions); // New style
```

### 3. Gradual File Migration
Instead of big-bang refactoring:
1. Create new implementation in @tm/cli
2. Add adapter in commands-adapter.js
3. Update commands.js to use adapter
4. Test both paths work
5. Eventually remove adapter when all migrated

## Benefits of This Approach

1. **No Breaking Changes**: Existing CLI continues to work
2. **Incremental PRs**: Each command can be migrated separately
3. **Parallel Development**: New features can use new architecture
4. **Easy Rollback**: Can disable new implementation if issues
5. **Clear Separation**: Business logic (core) vs presentation (cli/mcp/etc)

## Example PR Sequence

### PR 1: Core Package Setup ✅
- Create @tm/core
- Move types and interfaces
- Basic TaskMasterCore implementation

### PR 2: CLI Package Foundation ✅
- Create @tm/cli
- Command interface and registry
- Legacy bridge utilities

### PR 3: First Command Migration
- Migrate list-tasks to new system
- Add adapter in scripts
- Test both implementations

### PR 4-N: Migrate Commands One by One
- Each PR migrates 1-2 related commands
- Small, reviewable changes
- Continuous delivery

### Final PR: Cleanup
- Remove legacy implementations
- Remove adapters
- Update documentation

## Testing Strategy

### Dual Testing During Migration
```javascript
describe('List Tasks', () => {
  it('works with legacy implementation', async () => {
    // Force legacy
    const result = await legacyListTasks(...);
    expect(result).toBeDefined();
  });

  it('works with new implementation', async () => {
    // Force new
    const command = new ListTasksCommand();
    const result = await command.execute(...);
    expect(result.success).toBe(true);
  });

  it('adapter chooses correctly', async () => {
    // Let adapter decide
    const result = await listTasksAdapter(...);
    expect(result).toBeDefined();
  });
});
```

## Success Metrics

- [ ] All commands migrated without breaking changes
- [ ] Test coverage maintained or improved
- [ ] Performance maintained or improved
- [ ] Cleaner, more maintainable codebase
- [ ] Easy to add new interfaces (web, desktop, etc.)

## Notes for Contributors

1. **Keep PRs Small**: Migrate one command at a time
2. **Test Both Paths**: Ensure legacy and new both work
3. **Document Changes**: Update this roadmap as you go
4. **Communicate**: Discuss in PRs if architecture needs adjustment

This is a living document - update as the migration progresses!