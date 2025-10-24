# feat(tm-core): add !cmd: prefix support for environment variables

## Summary

This PR implements Phase 1 of the `!cmd:` prefix migration, adding command-based environment variable resolution to the `@tm/core` package's `EnvironmentConfigProvider` service.

The `!cmd:` prefix allows environment variables to execute shell commands and use their output, particularly useful for retrieving sensitive credentials from secure storage like macOS Keychain, pass, 1Password CLI, etc.

**Example usage:**
```bash
export OPENAI_API_KEY="!cmd:security find-generic-password -w -s openai-key"
```

## Phase 1 Scope

This PR contains **only** the tm-core implementation. Phase 2 (CLI and MCP migration) will be submitted as a separate PR to minimize risk and allow independent testing.

### Completed in this PR (Tasks 1-5, 12):
- ✅ Analysis of current JavaScript implementation
- ✅ Study of tm-core EnvironmentConfigProvider architecture
- ✅ Implementation of command execution utilities
- ✅ Integration of !cmd: support into EnvironmentConfigProvider
- ✅ Export verification (already exported via `@tm/core/config`)
- ✅ Updated changeset with feature documentation

### Deferred to Phase 2 (Tasks 6-9):
- ⏸️ Update CLI to use tm-core config services
- ⏸️ Update MCP server to use tm-core config services
- ⏸️ Remove or deprecate old JavaScript implementation in scripts/
- ⏸️ Migrate tests from old location

## Implementation Details

### Changes to EnvironmentConfigProvider

Added three private methods to `packages/tm-core/src/config/services/environment-config-provider.service.ts`:

1. **`parseTimeout()`**: Parses `TASKMASTER_CMD_TIMEOUT` environment variable with intelligent heuristic (≤60 = seconds, >60 = milliseconds)

2. **`executeCommand()`**: Executes shell commands with timeout and error handling, never logging sensitive command content or output

3. **`resolveValue()`**: Detects `!cmd:` prefix and resolves environment variable values

Modified `loadConfig()` to use `resolveValue()` for all environment variable mappings.

### Features

- **Configurable timeout** via `TASKMASTER_CMD_TIMEOUT` (default: 5 seconds)
- **Automatic timeout unit detection** (≤60 = seconds, >60 = milliseconds)
- **Security**: Commands and their output are never logged
- **Backward compatible**: Non-prefixed values work unchanged
- **Full shell access**: Supports pipes, variables, and other shell features
- **Error resilience**: Returns null on failure, allowing fallback logic

## Test Coverage

- **41/41 tests passing** (26 existing + 15 new for !cmd:)
- New tests cover:
  - Command execution success and trimming
  - Empty/whitespace-only command output
  - Empty command after prefix
  - Pass-through for non-prefixed values
  - Commands with special characters
  - Command failure handling
  - Timeout handling and parsing
  - Multiple environment variables with mixed !cmd: and plain values
  - Shell features (pipes, command substitution)

## Quality Checks

✅ All EnvironmentConfigProvider tests passing (41/41)
✅ Lint passing (biome check)
✅ TypeScript compilation passing
✅ No breaking changes
✅ Backward compatible
✅ Security preserved (no logging of sensitive data)

## Documentation

- ✅ Comprehensive JSDoc added to EnvironmentConfigProvider class and all new methods
- ✅ Migration specification document: `.taskmaster/docs/cmd-prefix-migration-spec.md`
- ✅ Migration status document: `.taskmaster/docs/cmd-migration-status.md`
- ✅ Changeset updated: `.changeset/wet-areas-admire.md`

## Commits

1. `44c67e63` - feat(tm-core): add command execution utilities to EnvironmentConfigProvider
2. `5aae5943` - feat(tm-core): integrate !cmd: prefix support into EnvironmentConfigProvider
3. `79cb2391` - test(tm-core): add comprehensive tests for !cmd: prefix support
4. `c4a2ce5d` - docs: add comprehensive migration specification for !cmd: feature
5. `853fbb0b` - docs(changeset): update with tm-core implementation details
6. `cc3ee939` - docs: add !cmd: migration status and phase plan

## Breaking Changes

None. This is a purely additive feature. Non-prefixed environment variables continue to work exactly as before.

## Migration Path for Phase 2

Phase 2 will migrate the CLI and MCP server from the JavaScript implementation in `scripts/modules/utils.js` to use the new TypeScript implementation in `@tm/core`. This will be done in a separate PR to:
- Minimize risk
- Allow independent testing of each phase
- Maintain clean commit history
- Enable easier rollback if needed

## Related

- Original implementation: `scripts/modules/utils.js` (lines 23-133)
- Tests: `tests/unit/scripts/modules/utils-command-keys.test.js`
- Status document: `.taskmaster/docs/cmd-migration-status.md`
- Migration spec: `.taskmaster/docs/cmd-prefix-migration-spec.md`

## Checklist

- [x] Tests pass
- [x] Lint passes
- [x] TypeScript compiles
- [x] Documentation updated
- [x] Changeset added
- [x] No breaking changes
- [x] Backward compatible
- [x] Security preserved
