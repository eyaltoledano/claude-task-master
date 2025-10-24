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

Implementation:
- Added to @tm/core EnvironmentConfigProvider service
- 41 comprehensive tests (26 existing + 15 new for !cmd:)
- Exported via @tm/core/config for use in CLI, MCP, and other consumers
