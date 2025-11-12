# Claude Code Provider Usage Example

The Claude Code provider allows you to use Claude models through the Claude Code CLI without requiring an API key.

## Configuration

To use the Claude Code provider, update your `.taskmaster/config.json`:

```json
{
  "models": {
    "main": {
      "provider": "claude-code",
      "modelId": "sonnet",
      "maxTokens": 64000,
      "temperature": 0.2
    },
    "research": {
      "provider": "claude-code",
      "modelId": "opus",
      "maxTokens": 32000,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "claude-code",
      "modelId": "sonnet",
      "maxTokens": 64000,
      "temperature": 0.2
    }
  }
}
```

## Available Models

- `opus` - Claude Opus model (SWE score: 0.725)
- `sonnet` - Claude Sonnet model (SWE score: 0.727)

## Usage

Once configured, you can use Claude Code with all Task Master commands:

```bash
# Generate tasks from a PRD
task-master parse-prd --input=prd.txt

# Analyze project complexity
task-master analyze-complexity

# Show the next task to work on
task-master next

# View a specific task
task-master show task-001

# Update task status
task-master set-status --id=task-001 --status=in-progress
```

## Requirements

1. Claude Code CLI must be installed and authenticated on your system
2. Install the optional `@anthropic-ai/claude-code` package if you enable this provider:
   ```bash
   npm install @anthropic-ai/claude-code
   ```
3. Run Claude Code for the first time and authenticate with your Anthropic account:
   ```bash
   claude
   ```
4. No API key is required in your environment variables or MCP configuration

## Advanced Settings

The Claude Code SDK supports additional settings that provide fine-grained control over Claude's behavior.  These settings are implemented in the underlying SDK (`src/ai-providers/custom-sdk/claude-code/`), and can be managed through Task Master's configuration file.

### Advanced Settings Usage

To update settings for Claude Code, update your `.taskmaster/config.json`:

The Claude Code settings can be specified globally in the `claudeCode` section of the config, or on a per-command basis in the `commandSpecific` section:

```javascript
{
  // "models" and "global" config...

  "claudeCode": {
    // Maximum conversation turns Claude can make in a single request
    "maxTurns": 5,
    
    // Custom system prompt to override Claude Code's default behavior
    "customSystemPrompt": "You are a helpful assistant focused on code quality",

    // Append additional content to the system prompt
    "appendSystemPrompt": "Always follow coding best practices",
    
    // Permission mode for file system operations
    "permissionMode": "default", // Options: "default", "acceptEdits", "plan", "bypassPermissions"
    
    // Explicitly allow only certain tools
    "allowedTools": ["Read", "LS"], // Claude can only read files and list directories
    
    // Explicitly disallow certain tools
    "disallowedTools": ["Write", "Edit"], // Prevent Claude from modifying files
    
    // MCP servers for additional tool integrations
    "mcpServers": {
      "mcp-server-name": {
        "command": "npx",
        "args": ["-y", "mcp-serve"],
        "env": {
          // ...
        }
      }
    }
  },

  // Command-specific settings override global settings
  "commandSpecific": {
    "parse-prd": {
      // Settings specific to the 'parse-prd' command
      "maxTurns": 10,
      "customSystemPrompt": "You are a task breakdown specialist"
    },
    "analyze-complexity": {
      // Settings specific to the 'analyze-complexity' command
      "maxTurns": 3,
      "appendSystemPrompt": "Focus on identifying bottlenecks"
    }
  }
}
```

- For a full list of Cluaude Code settings, see the [Claude Code Settings documentation](https://docs.anthropic.com/en/docs/claude-code/settings).
- For a full list of AI powered command names, see this file: `src/constants/commands.js`

### Why These Settings Matter

- **maxTurns**: Useful for complex refactoring tasks that require multiple iterations
- **customSystemPrompt**: Allows specializing Claude for specific domains or coding standards
- **appendSystemPrompt**: Useful for enforcing coding standards or providing additional context
- **permissionMode**: Critical for security in production environments
- **allowedTools/disallowedTools**: Enable read-only analysis modes or restrict access to sensitive operations
- **mcpServers**: Future extensibility for custom tool integrations

## Notes

- The Claude Code provider doesn't track usage costs (shown as 0 in telemetry)
- Session management is handled automatically for conversation continuity
- Some AI SDK parameters (temperature, maxTokens) are not supported by Claude Code CLI and will be ignored