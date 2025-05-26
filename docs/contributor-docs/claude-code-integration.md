# Claude Code CLI Integration - Contributor Documentation

## Overview

This document provides technical details about the Claude Code CLI integration for contributors who want to understand, maintain, or extend this feature.

## Architecture

### Provider Pattern

The Claude Code integration follows the established AI provider pattern in Taskmaster:

```
src/ai-providers/claude-code.js  → Provider implementation
    ↓
scripts/modules/ai-services-unified.js  → Service registration
    ↓
scripts/modules/config-manager.js  → Configuration handling
```

### Key Design Decisions

1. **No API Key Required**: Unlike other providers, Claude Code uses system-level authentication through the Claude Code CLI. The provider bypasses API key checks.

2. **Subprocess Communication**: Uses Node.js `spawn` instead of `exec` to handle stdin/stdout communication properly, avoiding shell escaping issues.

3. **Cost Tracking**: Claude Code returns `cost_usd: 0` in responses since it uses flat subscription pricing.

## Implementation Details

### Provider Module (`src/ai-providers/claude-code.js`)

The provider implements three main functions:

1. **`generateClaudeCodeText`**: For text generation tasks
2. **`streamClaudeCodeText`**: For streaming responses (currently uses non-streaming under the hood)
3. **`generateClaudeCodeObject`**: For structured JSON responses

All functions use a common `executeClaudeCommand` helper that:

- Spawns the `claude` CLI process
- Sends the prompt via stdin
- Parses the JSON response from stdout
- Handles errors and timeouts

### Configuration Updates

#### `scripts/modules/ai-services-unified.js`

- Added claude-code provider mapping
- Modified `_resolveApiKey` to return null for claude-code

#### `scripts/modules/config-manager.js`

- Added claude-code to API key bypass list (similar to ollama)
- Updated `isApiKeySet` and `getMcpApiKeyStatus` functions

#### `scripts/modules/supported-models.json`

- Added claude-code provider with zero-cost model

### Error Handling

The integration handles several error cases:

1. Claude Code CLI not installed
2. Invalid JSON responses
3. Command timeouts (30 seconds default)
4. Non-zero exit codes

## Testing

### Unit Tests

Create unit tests in `tests/unit/ai-providers/claude-code.test.js` to test:

- Successful command execution
- Error handling scenarios
- Response parsing
- Timeout handling

### Integration Tests

Add integration tests in `tests/integration/claude-code-integration.test.js` to verify:

- Provider registration in ai-services-unified
- Configuration loading and validation
- End-to-end command execution

### Manual Testing

Test all AI-dependent commands:

```bash
# Parse PRD
task-master parse-prd --file prd.txt

# Update single task
task-master update-task --id=1 --prompt="Add error handling"

# Expand task to subtasks
task-master expand --id=1

# Analyze complexity
task-master analyze-complexity

# Add new task
task-master add-task "Implement user authentication"

# Update multiple tasks
task-master update --from=5 --prompt="Add logging"

# Update subtask
task-master update-subtask --id=1.1 --prompt="Add unit tests"
```

## Debugging

### Enable Debug Mode

```bash
# In .taskmasterconfig
{
  "global": {
    "debug": true
  }
}
```

### Common Issues

1. **"claude: command not found"**: Claude Code CLI not installed or not in PATH
2. **JSON parse errors**: Check Claude Code CLI output format
3. **Timeout errors**: Increase timeout in `executeClaudeCommand`

## Future Enhancements

1. **Model Selection**: Add support for `--model` flag (opus/sonnet/haiku)
2. **Streaming**: Implement true streaming support
3. **Context Management**: Leverage Claude Code's context window management
4. **MCP Integration**: Utilize Claude Code's MCP capabilities

## Security Considerations

1. The integration runs shell commands via `spawn` with controlled arguments
2. User input is passed via stdin, not command arguments, avoiding injection risks
3. No API keys are stored or transmitted

## Performance Notes

- Claude Code CLI has startup overhead (~1-2 seconds)
- Response times depend on Claude Code's internal processing
- No rate limiting concerns due to subscription model

## Contributing

When modifying the Claude Code integration:

1. Update tests for any behavior changes
2. Update this documentation
3. Test all AI-dependent commands
4. Consider backward compatibility
5. Update the main user documentation in `docs/claude-code-integration.md`
