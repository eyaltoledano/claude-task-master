## TypeScript Migration - Phase 1: Infrastructure Setup

This PR begins the TypeScript migration for claude-task-master, addressing #5.

### Summary

Following the incremental approach suggested in #5, this PR sets up the TypeScript infrastructure without breaking existing JavaScript functionality. The migration will proceed gradually, starting with `src/` directory as the home for clean, refactored TypeScript code.

### Changes in this PR

1. **TypeScript Infrastructure** ✅
   - Added TypeScript and type definitions as dev dependencies
   - Created `tsconfig.json` with permissive settings for gradual migration
   - Added `tsup` for building TypeScript files to `dist/` folder
   - Added build scripts: `build`, `build:watch`, `typecheck`

2. **Migration Tracking**
   - Created `TYPESCRIPT_MIGRATION.md` to track progress
   - Defined clear phases for migration
   - Established testing strategy

### Migration Strategy

As suggested in #5, we're taking a "little by little" approach:

1. **Phase 1** (This PR): Set up tsconfig and tsup for compilation
2. **Phase 2** (Next): Start converting `src/` to TypeScript
3. **Phase 3+**: Gradually migrate other modules

The `src/` folder will be the primary location for refactored TypeScript code, keeping non-MCP related code clean and typed.

### Testing

- [x] `npm run typecheck` runs without errors
- [x] Existing JavaScript functionality remains unchanged
- [x] All existing tests still pass

### Next Steps

1. Create core type definitions
2. Convert files in `src/` to TypeScript
3. Gradually expand to other modules

This is a draft PR to signal the start of TypeScript migration. Will add more commits as the migration progresses.

### Related Issues

Closes #5 (when complete)