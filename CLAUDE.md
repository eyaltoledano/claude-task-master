# Claude Code Instructions

## Task Master AI Instructions

**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## Test Guidelines

### Test File Placement

- **Package & tests**: Place in `packages/<package-name>/src/<module>/<file>.spec.ts` or `apps/<app-name>/src/<module>/<file.spec.ts>` alongside source
- **Package integration tests**: Place in `packages/<package-name>/tests/integration/<module>/<file>.test.ts` or `apps/<app-name>/tests/integration/<module>/<file>.test.ts` alongside source
- **Isolated unit tests**: Use `tests/unit/packages/<package-name>/` only when parallel placement isn't possible
- **Test extension**: Always use `.ts` for TypeScript tests, never `.js`

### Synchronous Tests

- **NEVER use async/await in test functions** unless testing actual asynchronous operations
- Use synchronous top-level imports instead of dynamic `await import()`
- Test bodies should be synchronous whenever possible
- Example:

  ```typescript
  // ✅ CORRECT - Synchronous imports with .ts extension
  import { MyClass } from '../src/my-class.js';

  it('should verify behavior', () => {
    expect(new MyClass().property).toBe(value);
  });

  // ❌ INCORRECT - Async imports
  it('should verify behavior', async () => {
    const { MyClass } = await import('../src/my-class.js');
    expect(new MyClass().property).toBe(value);
  });
  ```

### When to Write Tests

**ALWAYS write tests for:**

- **Bug fixes**: Add a regression test that would have caught the bug
- **Business logic**: Complex calculations, validations, transformations
- **Edge cases**: Boundary conditions, error handling, null/undefined cases
- **Public APIs**: Methods other code depends on
- **Integration points**: Database, file system, external APIs

**SKIP tests for:**

- Simple getters/setters: `getX() { return this.x; }`
- Trivial pass-through functions with no logic
- Pure configuration objects
- Code that just delegates to another tested function

**Examples:**

```javascript
// ✅ WRITE A TEST - Bug fix with regression prevention
it('should use correct baseURL from defaultBaseURL config', () => {
  const provider = new ZAIProvider();
  expect(provider.defaultBaseURL).toBe('https://api.z.ai/api/paas/v4/');
});

// ✅ WRITE A TEST - Business logic with edge cases
it('should parse subtask IDs correctly', () => {
  expect(parseTaskId('1.2.3')).toEqual({ taskId: 1, subtaskId: 2, subSubtaskId: 3 });
  expect(parseTaskId('invalid')).toBeNull();
});

// ❌ SKIP TEST - Trivial getter
class Task {
  get id() { return this._id; } // No test needed
}

// ❌ SKIP TEST - Pure delegation
function getTasks() {
  return taskManager.getTasks(); // Already tested in taskManager
}
```

**Bug Fix Workflow:**

1. Encounter a bug
2. Write a failing test that reproduces it
3. Fix the bug
4. Verify test now passes
5. Commit both fix and test together

## Architecture Guidelines

### Business Logic Separation

**CRITICAL RULE**: ALL business logic must live in `@tm/core`, NOT in presentation layers.

- **`@tm/core`** (packages/tm-core/):
  - Contains ALL business logic, domain models, services, and utilities
  - Provides clean facade APIs through domain objects (tasks, auth, workflow, git, config)
  - Houses all complexity - parsing, validation, transformations, calculations, etc.
  - Example: Task ID parsing, subtask extraction, status validation, dependency resolution

- **`@tm/cli`** (apps/cli/):
  - Thin presentation layer ONLY
  - Calls tm-core methods and displays results
  - Handles CLI-specific concerns: argument parsing, output formatting, user prompts
  - NO business logic, NO data transformations, NO calculations

- **`@tm/mcp`** (apps/mcp/):
  - Thin presentation layer ONLY
  - Calls tm-core methods and returns MCP-formatted responses
  - Handles MCP-specific concerns: tool schemas, parameter validation, response formatting
  - NO business logic, NO data transformations, NO calculations

- **`apps/extension`** (future):
  - Thin presentation layer ONLY
  - Calls tm-core methods and displays in VS Code UI
  - NO business logic

**Examples of violations to avoid:**

- ❌ Creating helper functions in CLI/MCP to parse task IDs → Move to tm-core
- ❌ Data transformation logic in CLI/MCP → Move to tm-core
- ❌ Validation logic in CLI/MCP → Move to tm-core
- ❌ Duplicating logic across CLI and MCP → Implement once in tm-core

**Correct approach:**

- ✅ Add method to TasksDomain: `tasks.get(taskId)` (automatically handles task and subtask IDs)
- ✅ CLI calls: `await tmCore.tasks.get(taskId)` (supports "1", "1.2", "HAM-123", "HAM-123.2")
- ✅ MCP calls: `await tmCore.tasks.get(taskId)` (same intelligent ID parsing)
- ✅ Single source of truth in tm-core

## Documentation Guidelines

- **Documentation location**: Write docs in `apps/docs/` (Mintlify site source), not `docs/`
- **Documentation URL**: Reference docs at <https://docs.task-master.dev>, not local file paths

## Changeset Guidelines

- When creating changesets, remember that it's user-facing, meaning we don't have to get into the specifics of the code, but rather mention what the end-user is getting or fixing from this changeset.
