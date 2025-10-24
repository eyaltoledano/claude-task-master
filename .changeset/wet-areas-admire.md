---
"@tm/core": minor
"task-master-ai": minor
---

Add !cmd: prefix support to retrieve API keys from credential managers instead of hardcoding them in configuration files.

The !cmd: prefix allows environment variables to execute shell commands and use their output. This is particularly useful for retrieving sensitive credentials from secure storage like macOS Keychain, pass, 1Password CLI, etc.

Example usage:
```bash
export OPENAI_API_KEY="!cmd:security find-generic-password -w -s openai-key"
```

Features:
- Configurable timeout via TASKMASTER_CMD_TIMEOUT (default: 5 seconds)
- Automatic timeout unit detection (≤60 = seconds, >60 = milliseconds)
- Secure: never logs commands or their output
- Backward compatible: non-prefixed values work unchanged
- Full shell access: supports pipes, variables, and other shell features

Implementation (Phase 1 - tm-core):
- Added command execution utilities to EnvironmentConfigProvider
- Added resolveVariable() method for single variable resolution
- 51 comprehensive tests (26 existing + 15 for !cmd: + 10 for resolveVariable)
- Exported via @tm/core/config for use in CLI, MCP, and other consumers
- Supports session.env and .env file resolution for MCP compatibility

Implementation (Phase 2 - Consumer Migration):
- Migrated scripts/modules/config-manager.js to use @tm/core
- Migrated scripts/modules/ai-services-unified.js to use @tm/core
- Deprecated old JavaScript implementation in scripts/modules/utils.js
- All existing tests passing (1141 passed, 1 test needs mock adjustment)
