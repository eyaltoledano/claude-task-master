# MCP Provider Integration Guide

## Overview

The MCP (Model Context Protocol) provider enables Task Master to act as an MCP client, using MCP servers as AI providers alongside traditional API-based providers. This integration follows the existing provider pattern and supports all standard AI operations.

## What is MCP Provider?

The MCP provider allows Task Master to:
- Connect to MCP servers/tools as AI providers
- Use session-based authentication instead of API keys
- Map AI operations to MCP tool calls
- Integrate with existing role-based provider assignment
- Maintain compatibility with fallback chains

## Configuration

### Basic Setup

Add MCP provider to your `.taskmasterconfig`:

```json
{
  "models": {
    "main": {
      "provider": "mcp",
      "modelId": "mcp-sampling"
    },
    "research": {
      "provider": "mcp", 
      "modelId": "mcp-sampling"
    },
    "fallback": {
      "provider": "anthropic",
      "modelId": "claude-3-5-sonnet-20241022"
    }
  }
}
```

### Available Models

The MCP provider supports sampling-based text generation:

- **`mcp-sampling`** - General text generation using MCP client sampling (all roles)

### Model ID Format

MCP model IDs use a simple format:

- **`mcp-sampling`** - Uses MCP client's sampling capability for text generation

## Session Requirements

The MCP provider requires an active MCP session with sampling capabilities:

```javascript
session: {
  clientCapabilities: {
    sampling: {} // Client supports sampling requests
  },
  requestSampling: function(params) {
    // MCP sampling implementation
    // Returns completion from client's model
  }
}
```

## Usage Examples

### Basic Text Generation

```javascript
import { generateTextService } from './scripts/modules/ai-services-unified.js';

const result = await generateTextService({
  role: 'main',
  session: mcpSession, // Required for MCP provider
  prompt: 'Explain MCP integration',
  systemPrompt: 'You are a helpful AI assistant'
});

console.log(result.text);
```

### Structured Object Generation

```javascript
import { generateObjectService } from './scripts/modules/ai-services-unified.js';

const result = await generateObjectService({
  role: 'main',
  session: mcpSession,
  prompt: 'Create a task breakdown',
  schema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  }
});

console.log(result.object);
```

### Research Operations

```javascript
const research = await generateTextService({
  role: 'research',
  session: mcpSession,
  prompt: 'Research the latest developments in AI',
  systemPrompt: 'You are a research assistant'
});
```

## CLI Integration

The MCP provider works seamlessly with Task Master CLI commands when running in an MCP context:

```bash
# Generate tasks using MCP provider (if configured as main)
task-master add-task "Implement user authentication"

# Research using MCP provider (if configured as research)
task-master research "OAuth 2.0 best practices"

# Parse PRD using MCP provider
task-master parse-prd requirements.txt
```

## Architecture Details

### Provider Pattern Integration

The MCP provider follows the same pattern as other providers:

```javascript
class MCPAIProvider extends BaseAIProvider {
  // Implements generateText, streamText, generateObject
  // Uses session context instead of API keys
  // Maps operations to MCP tool calls
}
```

### Session Detection

The provider automatically detects MCP sampling capability:

```javascript
// Check if MCP sampling is available
if (MCPAIProvider.isAvailable({ session })) {
  // Use MCP provider with sampling
}
```

### Sampling Integration

AI operations use MCP sampling:

- `generateText()` → MCP `requestSampling()` with messages
- `streamText()` → Falls back to `generateText()` (streaming not supported)
- `generateObject()` → MCP `requestSampling()` with JSON schema instructions

### Error Handling

The MCP provider includes comprehensive error handling:

- Session validation errors (checks for `clientCapabilities.sampling`)
- MCP sampling request failures
- JSON parsing errors (for structured output)
- Automatic fallback to other providers

## Best Practices

### 1. Configure Fallbacks

Always configure a non-MCP fallback provider:

```json
{
  "models": {
    "main": {
      "provider": "mcp",
      "modelId": "mcp-sampling"
    },
    "fallback": {
      "provider": "anthropic",
      "modelId": "claude-3-5-sonnet-20241022"
    }
  }
}
```

### 2. Session Management

Ensure your MCP session remains active throughout Task Master operations:

```javascript
// Check session health before operations
if (!session || !session.capabilities) {
  throw new Error('MCP session not available');
}
```

### 3. Tool Availability

Verify required tools are available in your MCP session:

```javascript
const availableModels = MCPAIProvider.getAvailableModels(session);
console.log('Available MCP models:', availableModels);
```

### 4. Error Recovery

Handle MCP-specific errors gracefully:

```javascript
try {
  const result = await generateTextService({
    role: 'main',
    session: mcpSession,
    prompt: 'Generate content'
  });
} catch (error) {
  if (error.message.includes('MCP')) {
    // Handle MCP-specific error
    console.log('MCP error, falling back to alternate provider');
  }
}
```

## Troubleshooting

### Common Issues

1. **"MCP provider requires session context"**
   - Ensure `session` parameter is passed to service calls
   - Verify session has proper structure

2. **"MCP session must have client sampling capabilities"**
   - Check that `session.clientCapabilities.sampling` exists
   - Verify session has `requestSampling()` method

3. **"MCP sampling failed"**
   - Check MCP client is responding to sampling requests
   - Verify session is still active and connected

4. **"Cannot access 'BaseAIProvider' before initialization"**
   - This indicates a circular import issue
   - Should be resolved in current implementation

### Debug Mode

Enable debug logging to see MCP provider operations:

```javascript
// Set debug flag in config or environment
process.env.DEBUG = 'true';

// Or in .taskmasterconfig
{
  "debug": true,
  "models": { /* ... */ }
}
```

### Testing MCP Integration

Test MCP provider functionality:

```javascript
// Check if MCP provider is properly registered
import { MCPAIProvider } from './src/ai-providers/mcp-provider.js';

// Test session detection
const isAvailable = MCPAIProvider.isAvailable({ session: yourSession });
console.log('MCP available:', isAvailable);

// Test available models
const models = MCPAIProvider.getAvailableModels(yourSession);
console.log('Available models:', models);
```

## Integration with Development Tools

### Claude Desktop

When using Task Master through Claude Desktop's MCP integration:

1. Configure Task Master as MCP provider in Claude Desktop
2. Use MCP provider for AI operations within Task Master
3. Benefit from nested MCP tool calling capabilities

### Cursor and Other MCP Clients

The MCP provider works with any MCP-compatible development environment:

1. Ensure your IDE has MCP client capabilities
2. Configure Task Master MCP server endpoint
3. Use MCP provider for enhanced AI-driven development

## Advanced Configuration

### Custom Tool Mapping

Advanced users can use MCP sampling for all roles:

```javascript
// MCP sampling for all roles
{
  "models": {
    "main": {
      "provider": "mcp",
      "modelId": "mcp-sampling"
    }
  }
}
```

### Role-Specific Configuration

Configure MCP sampling for different roles:

```json
{
  "models": {
    "main": {
      "provider": "mcp",
      "modelId": "mcp-sampling"
    },
    "research": {
      "provider": "mcp", 
      "modelId": "mcp-sampling"
    },
    "fallback": {
      "provider": "mcp",
      "modelId": "backup-server:simple-generation"
    }
  }
}
```

## API Reference

### MCPAIProvider Methods

- `isAvailable(params)` - Check if MCP context is available
- `validateAuth(params)` - Validate session context
- `generateText(params)` - Generate text using MCP tools
- `streamText(params)` - Stream text (falls back to generateText)
- `generateObject(params)` - Generate structured objects
- `getAvailableModels(session)` - Get available MCP models

### Required Parameters

All MCP operations require:
- `session` - Active MCP session object
- `modelId` - MCP tool identifier
- `messages` - Array of message objects

### Optional Parameters

- `temperature` - Creativity control (if supported by MCP tool)
- `maxTokens` - Maximum response length (if supported)
- `schema` - JSON schema for structured output (generateObject only)

## Security Considerations

1. **Session Security**: MCP sessions should be properly authenticated
2. **Tool Validation**: Only use trusted MCP tools and servers
3. **Data Privacy**: Ensure MCP tools handle data according to your privacy requirements
4. **Error Exposure**: Be careful not to expose sensitive session information in error messages

## Future Enhancements

Planned improvements for MCP provider:

1. **True Streaming Support** - Native streaming for compatible MCP tools
2. **Enhanced Tool Discovery** - Automatic detection of tool capabilities
3. **Session Health Monitoring** - Automatic session validation and recovery
4. **Performance Optimization** - Caching and connection pooling
5. **Advanced Error Recovery** - Intelligent retry and fallback strategies
