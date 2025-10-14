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

## Documentation Guidelines

- **Documentation location**: Write docs in `apps/docs/` (Mintlify site source), not `docs/`
- **Documentation URL**: Reference docs at https://docs.task-master.dev, not local file paths

## Changeset Guidelines

- When creating changesets, remember that it's user-facing, meaning we don't have to get into the specifics of the code, but rather mention what the end-user is getting or fixing from this changeset.