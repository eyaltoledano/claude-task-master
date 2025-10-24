# !cmd: Prefix Migration Specification

## Overview
This document specifies the migration of the `!cmd:` prefix feature from `scripts/modules/utils.js` to `packages/tm-core/src/config/services/environment-config-provider.service.ts`.

## Current Implementation Analysis

### Location
- **Source**: `scripts/modules/utils.js` (lines 23-133)
- **Tests**: `tests/unit/scripts/modules/utils-command-keys.test.js` (333 lines)

### Core Functions

#### 1. `parseTimeout()` (lines 29-38)
- Reads `TASKMASTER_CMD_TIMEOUT` environment variable
- Default: 5000ms
- Heuristic: values ≤60 treated as seconds, >60 as milliseconds
- Returns timeout in milliseconds

#### 2. `executeCommandForKey(command, keyName, opts)` (lines 48-69)
- Executes shell command via `execSync`
- Parameters:
  - `command`: Shell command to execute
  - `keyName`: Used for error logging only
  - `opts.timeoutMs`: Optional custom timeout
- Execution options:
  - `encoding: 'utf8'`
  - `timeout`: From opts or parseTimeout()
  - `stdio: ['ignore', 'pipe', 'pipe']` (no stdin, capture stdout/stderr)
  - `shell: true`
- Returns: Trimmed stdout or null on failure
- Error handling:
  - Returns null for: timeout, empty output, execution failures
  - Logs error with reason but NEVER logs command or output (security)
  - Error reason: `err.killed ? 'timeout' : (err.status ?? err.code ?? 'exec-failed')`

#### 3. `resolveEnvVariable(key, session, projectRoot)` (lines 85-133)
- Resolution precedence:
  1. `session.env[key]` (MCP sessions)
  2. `.env` file at projectRoot (parsed with dotenv)
  3. `process.env[key]`
- Command detection:
  - Checks if value starts with `!cmd:` prefix
  - Extracts command: `value.slice('!cmd:'.length).trim()`
  - Returns undefined if prefix present but command empty
  - Calls `executeCommandForKey()` for execution
- Returns: string value, null (command failed), or undefined (not found)

### Key Features
1. **Security**: Never logs sensitive command content or output
2. **Timeout control**: Configurable via `TASKMASTER_CMD_TIMEOUT`
3. **Multi-source resolution**: session > .env file > process.env
4. **Backward compatibility**: Non-prefixed values pass through unchanged
5. **Error resilience**: Returns null on failure, allowing fallback logic

### Integration Points
- **Consumers**: CLI and MCP server for API key resolution
- **Dependencies**: `node:child_process.execSync`, `dotenv.parse`, `fs`, `path`

### Test Coverage
- parseTimeout: default, seconds, milliseconds, invalid values
- executeCommandForKey: success, empty output, timeout, failures
- resolveEnvVariable: !cmd: detection, session/process/.env sources
- Edge cases: special chars, whitespace, error codes

---

## tm-core EnvironmentConfigProvider Architecture

### Service Architecture
tm-core follows clean architecture with specialized config services:

**ConfigManager** (config-manager.ts) - Orchestrator
- Creates and coordinates all config services
- Factory pattern: `ConfigManager.create()` for async initialization
- Instantiates EnvironmentConfigProvider once (line 70)
- Calls `envProvider.loadConfig()` during initialization (line 111)

**EnvironmentConfigProvider** (environment-config-provider.service.ts)
- Single responsibility: Extract configuration from environment variables
- EnvMapping interface: `{ env, path[], validate?, isRuntimeState? }`
- `loadConfig()`: Returns PartialConfiguration (skips runtime state vars)
- `getRuntimeState()`: Returns only runtime state vars
- No value transformation (preserves as-is, no trimming)
- Supports custom mappings via constructor or `addMapping()`
- Uses logger for validation warnings

**Config Precedence** (from ConfigMerger):
1. Defaults (lowest)
2. Global config
3. Local project config
4. Environment variables (highest) ← !cmd: will inherit this precedence

### Testing Patterns (vitest)
- `beforeEach`/`afterEach` for env cleanup
- Comprehensive coverage: basic loading, validation, custom mappings, edge cases
- Mock `console.warn` for validation testing
- Tests preserve-as-is behavior (no trimming)

### Integration Points

**Current flow**:
1. `ConfigManager.create(projectRoot)` → `new EnvironmentConfigProvider()`
2. `manager.initialize()` → `envProvider.loadConfig()`
3. Config merged with highest precedence for env vars
4. Used throughout tm-core via `ConfigManager.getConfig()`

**Consumers**:
- No direct imports of EnvironmentConfigProvider outside config services
- All access through ConfigManager

---

## Design Decision: !cmd: Integration

### Recommendation
**Extend EnvironmentConfigProvider** (NOT create a separate service)

### Rationale
1. `!cmd:` is a form of environment variable resolution, fits existing responsibility
2. `loadConfig()` already reads `process.env`, natural extension point
3. Maintains service cohesion and single responsibility
4. Avoids splitting env var logic across multiple services
5. ConfigManager doesn't need to know about command execution details

### Implementation Approach

Add the following private methods to EnvironmentConfigProvider:

```typescript
private readonly CMD_PREFIX = '!cmd:';

/**
 * Resolve environment variable value, handling !cmd: prefix
 */
private resolveValue(value: string, envName: string): string | null {
  if (!value.startsWith(this.CMD_PREFIX)) {
    return value;
  }

  const command = value.slice(this.CMD_PREFIX.length).trim();
  if (!command) {
    this.logger.warn(`Empty command for ${envName}`);
    return null;
  }

  return this.executeCommand(command, envName);
}

/**
 * Execute command to retrieve environment variable value
 */
private executeCommand(command: string, envName: string): string | null {
  try {
    const timeout = this.parseTimeout();
    const result = execSync(command, {
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    const trimmed = (result ?? '').trim();
    if (!trimmed) {
      throw new Error('empty-result');
    }

    return trimmed;
  } catch (err: any) {
    const reason = err?.killed
      ? 'timeout'
      : (err?.status ?? err?.code ?? 'exec-failed');
    this.logger.error(`Error executing command for ${envName}: ${String(reason)}`);
    return null;
  }
}

/**
 * Parse timeout from TASKMASTER_CMD_TIMEOUT environment variable
 */
private parseTimeout(): number {
  const raw = process.env.TASKMASTER_CMD_TIMEOUT;
  if (!raw) return 5000;

  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 5000;

  // Heuristic: <=60 => seconds; else milliseconds
  return n <= 60 ? n * 1000 : n;
}
```

Modify `loadConfig()` to use `resolveValue()`:

```typescript
loadConfig(): PartialConfiguration {
  const config: PartialConfiguration = {};

  for (const mapping of this.mappings) {
    // Skip runtime state variables
    if (mapping.isRuntimeState) continue;

    const rawValue = process.env[mapping.env];
    if (!rawValue) continue;

    // Resolve value (handles !cmd: prefix)
    const value = this.resolveValue(rawValue, mapping.env);
    if (!value) continue; // Command failed or returned null

    // Validate value if validator is provided
    if (mapping.validate && !mapping.validate(value)) {
      this.logger.warn(`Invalid value for ${mapping.env}: ${value}`);
      continue;
    }

    // Set the value in the config object
    this.setNestedProperty(config, mapping.path, value);
  }

  return config;
}
```

### Changes Required

1. **Add command execution utilities as private methods**
   - `parseTimeout()`: Parse TASKMASTER_CMD_TIMEOUT with heuristic
   - `executeCommand()`: Execute command with timeout and error handling
   - `resolveValue()`: Detect !cmd: prefix and resolve value

2. **Modify loadConfig()**
   - Call `resolveValue()` after reading `process.env[mapping.env]`
   - Handle null returns (command failures) gracefully
   - Skip null values (don't set in config)

3. **Add comprehensive tests**
   - Test !cmd: functionality in existing test suite
   - Cover: success, timeout, failure, empty output, edge cases
   - Ensure security: never log commands or output

4. **Update documentation**
   - Add JSDoc for new methods
   - Document !cmd: feature in EnvironmentConfigProvider class JSDoc
   - Update package README if needed

### Preservation Requirements

- **No breaking changes**: Maintain all existing EnvironmentConfigProvider behavior
- **Security**: Never log commands or output (sensitive data)
- **Configuration**: Support TASKMASTER_CMD_TIMEOUT environment variable
- **Error handling**: Return null on command failure (don't throw)
- **Backward compatibility**: Non-prefixed values unchanged
- **Test compatibility**: All existing tests must pass

---

## TypeScript Migration Considerations

### Type Definitions

```typescript
import { execSync } from 'node:child_process';

interface CommandExecutionOptions {
  timeoutMs?: number;
}
```

### Return Types
- `parseTimeout()`: `number`
- `executeCommand(command: string, envName: string)`: `string | null`
- `resolveValue(value: string, envName: string)`: `string | null`

### Error Handling
- Use proper TypeScript error typing: `catch (err: any)`
- Type guard for error properties: `err?.killed`, `err?.status`, `err?.code`

---

## Migration Steps

1. ✅ **Task 1**: Analyze current implementation (COMPLETE)
2. ✅ **Task 2**: Study tm-core architecture (COMPLETE)
3. **Task 3**: Implement command execution utilities in tm-core
4. **Task 4**: Extend EnvironmentConfigProvider with !cmd: support
5. **Task 5**: Export new functionality from tm-core package
6. **Task 6**: Update CLI to use tm-core config services
7. **Task 7**: Update MCP server to use tm-core config services
8. **Task 8**: Remove or deprecate old implementation in scripts/
9. **Task 9**: Migrate or remove tests from old location
10. **Task 10**: Update documentation for !cmd: feature
11. **Task 11**: Run full CI test suite and fix any failures
12. **Task 12**: Update changeset with migration details
13. **Task 13**: Final verification and create PR

---

## Testing Strategy

### New Tests to Add
1. Command execution success with trimmed output
2. Command execution with empty/whitespace-only output
3. Command execution timeout
4. Command execution failure (non-zero exit)
5. !cmd: prefix detection and parsing
6. Empty command after prefix
7. Non-prefixed values pass through unchanged
8. TASKMASTER_CMD_TIMEOUT parsing (default, seconds, milliseconds, invalid)
9. Security: verify no logging of commands or output
10. Integration with existing env var resolution

### Test File Location
`packages/tm-core/src/config/services/environment-config-provider.service.spec.ts`

### Test Pattern
Follow existing vitest patterns with beforeEach/afterEach for env cleanup.

---

## Documentation Updates

### JSDoc for EnvironmentConfigProvider Class
```typescript
/**
 * EnvironmentConfigProvider extracts configuration from environment variables
 *
 * Supports command-based resolution using the !cmd: prefix:
 * - Values starting with !cmd: will execute the command and use its output
 * - Commands timeout after 5 seconds (configurable via TASKMASTER_CMD_TIMEOUT)
 * - Failed commands return null and log an error
 * - Security: Commands and their output are never logged
 *
 * Example:
 * ```bash
 * export OPENAI_API_KEY="!cmd:security find-generic-password -w -s openai-key"
 * ```
 *
 * Single responsibility: Environment variable configuration extraction
 */
```

### Method JSDoc
Add comprehensive JSDoc for all new private methods with @param, @returns, @throws annotations.
