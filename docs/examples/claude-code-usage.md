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
2. No API key is required in your environment variables or MCP configuration

## Advanced Settings

The Claude Code SDK supports additional settings that provide fine-grained control over Claude's behavior. While these settings are implemented in the underlying SDK (`src/ai-providers/custom-sdk/claude-code/`), they are not currently exposed through Task Master's standard API due to architectural constraints.

### Supported Settings

```javascript
const settings = {
  // Maximum conversation turns Claude can make in a single request
  maxTurns: 5,
  
  // Custom system prompt to override Claude Code's default behavior
  customSystemPrompt: "You are a helpful assistant focused on code quality",
  
  // Permission mode for file system operations
  permissionMode: 'default', // Options: 'default', 'restricted', 'permissive'
  
  // Explicitly allow only certain tools
  allowedTools: ['Read', 'LS'], // Claude can only read files and list directories
  
  // Explicitly disallow certain tools
  disallowedTools: ['Write', 'Edit'], // Prevent Claude from modifying files
  
  // MCP servers for additional tool integrations
  mcpServers: []
};
```

### Current Limitations

Task Master uses a standardized `BaseAIProvider` interface that only passes through common parameters (modelId, messages, maxTokens, temperature) to maintain consistency across all providers. The Claude Code advanced settings are implemented in the SDK but not accessible through Task Master's high-level commands.

### Future Integration Options

For developers who need to use these advanced settings, there are three potential approaches:

#### Option 1: Extend BaseAIProvider
Modify the core Task Master architecture to support provider-specific settings:

```javascript
// In BaseAIProvider
const result = await generateText({
  model: client(params.modelId),
  messages: params.messages,
  maxTokens: params.maxTokens,
  temperature: params.temperature,
  ...params.providerSettings // New: pass through provider-specific settings
});
```

#### Option 2: Override Methods in ClaudeCodeProvider
Create custom implementations that extract and use Claude-specific settings:

```javascript
// In ClaudeCodeProvider
async generateText(params) {
  const { maxTurns, allowedTools, disallowedTools, ...baseParams } = params;
  
  const client = this.getClient({
    ...baseParams,
    settings: { maxTurns, allowedTools, disallowedTools }
  });
  
  // Continue with generation...
}
```

#### Option 3: Direct SDK Usage
For immediate access to advanced features, developers can use the Claude Code SDK directly:

```javascript
import { createClaudeCode } from 'task-master-ai/ai-providers/custom-sdk/claude-code';

const claude = createClaudeCode({
  defaultSettings: {
    maxTurns: 5,
    allowedTools: ['Read', 'LS'],
    disallowedTools: ['Write', 'Edit']
  }
});

const model = claude('sonnet');
const result = await generateText({
  model,
  messages: [{ role: 'user', content: 'Analyze this code...' }]
});
```

### Why These Settings Matter

- **maxTurns**: Useful for complex refactoring tasks that require multiple iterations
- **customSystemPrompt**: Allows specializing Claude for specific domains or coding standards
- **permissionMode**: Critical for security in production environments
- **allowedTools/disallowedTools**: Enable read-only analysis modes or restrict access to sensitive operations
- **mcpServers**: Future extensibility for custom tool integrations

## Notes

- The Claude Code provider doesn't track usage costs (shown as 0 in telemetry)
- Session management is handled automatically for conversation continuity
- Some AI SDK parameters (temperature, maxTokens) are not supported by Claude Code CLI and will be ignored