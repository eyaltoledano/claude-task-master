# MCP Sampling Provider Usage Guide

The MCP Sampling provider allows Task Master to use AI models through the Model Context Protocol (MCP) sampling interface, enabling integration with MCP-compatible clients without requiring API keys.

## Overview

The MCP Sampling provider is designed for scenarios where Task Master is running as an MCP server and needs to request AI completions from connected MCP clients. This creates a unique architecture where Task Master can leverage the AI capabilities of the client that's connected to it.

## Configuration

To use the MCP Sampling provider, update your `.taskmaster/config.json`:

```json
{
  "models": {
    "main": {
      "provider": "mcp-sampling",
      "modelId": "claude-3-opus",  // This is a hint, not a direct selection
      "maxTokens": 4096,
      "temperature": 0.7
    },
    "research": {
      "provider": "mcp-sampling",
      "modelId": "gpt-4",  // Client decides actual model based on hints
      "maxTokens": 4096,
      "temperature": 0.5
    },
    "fallback": {
      "provider": "mcp-sampling",
      "modelId": "fast",  // Can use capability hints instead of model names
      "maxTokens": 2048,
      "temperature": 0.3
    }
  }
}
```

**Important**: The `modelId` field is treated as a hint in MCP Sampling. The connected client makes the final decision about which model to use based on its available models and your preferences.

## How It Works

Unlike traditional API-based providers, MCP Sampling works through a client-server relationship:

1. **Task Master as MCP Server**: Task Master runs as an MCP server
2. **Client Connection**: An MCP-compatible client (like Claude Desktop) connects to Task Master
3. **Sampling Requests**: When Task Master needs AI completions, it requests them from the connected client
4. **Client Processing**: The client uses its configured AI provider to generate responses
5. **Response Delivery**: The client returns the AI response to Task Master

## Requirements

1. **MCP Server Mode**: Task Master must be running as an MCP server
2. **MCP Client**: A connected MCP client with sampling capabilities
3. **Client Configuration**: The client must have:
   - Sampling capabilities enabled
   - Access to an AI provider (e.g., Anthropic API)
   - Proper authentication for its AI provider

## Usage Examples

### Basic Task Generation

```bash
# Start Task Master as an MCP server
task-master-mcp

# In your MCP client, connect to Task Master
# Then use Task Master commands normally:

# Generate tasks from a PRD
task-master parse-prd --input=requirements.txt

# Analyze project complexity
task-master analyze-complexity

# Show next task
task-master next
```

### Programmatic Usage

When using Task Master programmatically with MCP Sampling:

```javascript
import { AIService } from 'task-master-ai';

// The MCP session is automatically injected when running as MCP server
const result = await AIService.generateText({
  provider: 'mcp-sampling',
  modelId: 'claude-3-opus',  // This is a hint - client chooses actual model
  messages: [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'Explain the repository structure.' }
  ],
  maxTokens: 2048,
  temperature: 0.7
});
```

## Provider Settings

The MCP Sampling provider supports the following settings:

```javascript
const settings = {
  // MCP session object (automatically injected in MCP server mode)
  session: mcpSession,
  
  // Request timeout in milliseconds (default: 120000 = 2 minutes)
  timeout: 120000,
  
  // Context inclusion mode for MCP sampling
  includeContext: 'thisServer', // Options: 'thisServer', 'none', 'all'
  
  // Model selection priorities (0-1 scale)
  costPriority: 0.5,         // Balance cost consideration
  speedPriority: 0.5,        // Balance speed consideration
  intelligencePriority: 0.5, // Balance capability consideration
  
  // Standard AI parameters
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompt: 'Custom system prompt for all requests'
};
```

## Model Selection

MCP Sampling uses a preference-based model selection system rather than direct model specification:

### How It Works

1. **Model Hints**: The `modelId` you specify is treated as a hint, not a direct selection
2. **Client Control**: The connected client makes the final model choice based on:
   - Available models in the client
   - Your provided hints
   - Model capability priorities
3. **Flexible Matching**: Hints are matched as substrings, so "claude" might match any Claude model

### Common Model Hints

- `claude-3-opus`, `opus` - Suggests most capable Claude model
- `claude-3-sonnet`, `sonnet` - Suggests balanced Claude model
- `gpt-4`, `gpt-4-turbo` - Suggests GPT-4 family models
- `gemini`, `gemini-pro` - Suggests Google's Gemini models
- `fast` - Suggests a fast, efficient model
- `smart` - Suggests a more capable model

### Model Priorities

You can also influence model selection through priority settings:

```javascript
const settings = {
  // Influence model selection (0-1 scale)
  costPriority: 0.3,         // Lower = cost less important
  speedPriority: 0.7,        // Higher = prefer faster models
  intelligencePriority: 0.8  // Higher = prefer smarter models
};
```

## Context Inclusion

The `includeContext` setting controls what context is included in sampling requests:

- `'thisServer'` (default): Include context from the Task Master MCP server
- `'none'`: No additional context included
- `'all'`: Include all available context (if supported by client)

## Error Handling

The MCP Sampling provider includes robust error handling for common scenarios:

### Session Errors
```javascript
// Error: MCP session is required but not provided
// Solution: Ensure Task Master is running as MCP server with connected client
```

### Capability Errors
```javascript
// Error: MCP session does not have sampling capabilities
// Solution: Verify client has sampling enabled in its configuration
```

### Timeout Errors
```javascript
// Error: MCP Sampling request timed out after 120000ms
// Solution: Increase timeout setting or check client responsiveness
```

## Limitations

1. **No Direct Model Selection**: You provide hints; the client chooses the actual model
2. **No Streaming**: MCP Sampling doesn't support streaming responses
3. **No Token Counting**: Usage metrics show 0 tokens (not provided by MCP)
4. **No Tool Calling**: Function/tool calling is not supported
5. **Session Dependency**: Requires active MCP session with capable client
6. **Client-Dependent**: Model availability depends on connected client

## Advanced Integration

### Custom Session Management

For advanced use cases, you can manually manage MCP sessions:

```javascript
import { McpSamplingProvider } from 'task-master-ai/ai-providers';

const provider = new McpSamplingProvider();
const client = provider.getClient({
  session: customMcpSession,
  timeout: 300000, // 5 minutes
  includeContext: 'all'
});

const model = client('claude-3-opus', {
  // Optional: Set specific priorities for this request
  intelligencePriority: 0.9,  // Prefer smarter model for analysis
  speedPriority: 0.3          // Speed less important
});
const result = await generateText({
  model,
  messages: [{ role: 'user', content: 'Analyze this codebase' }]
});
```

### Direct SDK Usage

For maximum control, use the MCP Sampling SDK directly:

```javascript
import { createMcpSampling } from 'task-master-ai/ai-providers/custom-sdk/mcp-sampling';

const mcpSampling = createMcpSampling({
  defaultSettings: {
    session: mcpSession,
    timeout: 60000,
    includeContext: 'thisServer'
  }
});

const model = mcpSampling.languageModel('claude-3-sonnet', {
  // The model hint will be sent to the client
  // Client makes final model selection
});
// Use with AI SDK functions
```

## Best Practices

1. **Session Validation**: Always ensure MCP session is active before operations
2. **Timeout Configuration**: Set appropriate timeouts for long-running tasks
3. **Error Recovery**: Implement retry logic for transient failures
4. **Model Hints**: Use appropriate hints that match client's available models
5. **Context Management**: Use appropriate context inclusion for performance

## Troubleshooting

### No MCP Session
```bash
# Check if Task Master is running as MCP server
ps aux | grep task-master-mcp

# Verify client connection in logs
tail -f .taskmaster/logs/mcp-server.log
```

### Sampling Failures
```bash
# Check client capabilities
task-master mcp-info

# Verify client has sampling enabled
# Check client's MCP configuration
```

### Performance Issues
- Reduce `maxTokens` for faster responses
- Adjust `timeout` based on network conditions
- Use `includeContext: 'none'` to reduce payload size

## Security Considerations

1. **Client Trust**: Only connect trusted MCP clients
2. **Data Privacy**: Requests are sent to client's AI provider
3. **Session Security**: MCP sessions should use secure transport
4. **Access Control**: Limit which clients can connect to your MCP server

## Notes

- The MCP Sampling provider is ideal for integrated development environments
- Works seamlessly when Task Master runs as an MCP server
- Provider selection happens at runtime based on available sessions
- No API keys needed in Task Master configuration