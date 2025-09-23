# MCP Provider Integration Guide

## Overview

Task Master provides a **unified MCP provider** for AI operations:

**MCP Provider** (`mcp`) - Modern AI SDK-compatible provider with full structured object generation support

The MCP provider enables Task Master to act as an MCP client, using MCP servers as AI providers alongside traditional API-based providers. This integration follows the existing provider pattern and supports all standard AI operations including structured object generation for PRD parsing and task creation.

## MCP Provider Features

The **MCP Provider** (`mcp`) provides:

✅ **Full AI SDK Compatibility** - Complete LanguageModelV1 interface implementation  
✅ **Structured Object Generation** - Schema-driven outputs for PRD parsing and task creation  
✅ **Enhanced Error Handling** - Robust JSON extraction and validation  
✅ **Session Management** - Automatic session detection and context handling  
✅ **Schema Validation** - Type-safe object generation with Zod validation  

### Quick Setup

```bash
# Set MCP provider for main role  
task-master models set-main --provider mcp --model claude-3-5-sonnet-20241022
```

For detailed information, see [MCP Provider Documentation](mcp-provider.md).

## What is MCP Provider?

The MCP provider allows Task Master to:
- Connect to MCP servers/tools as AI providers
- Use session-based authentication instead of API keys
- Map AI operations to MCP tool calls
- Integrate with existing role-based provider assignment
- Maintain compatibility with fallback chains
- Support structured object generation for schema-driven features

## Configuration

### MCP Provider Setup

Add MCP provider to your `.taskmaster/config.json`:

```json
{
  "models": {
    "main": {
      "provider": "mcp",
      "modelId": "claude-3-5-sonnet-20241022",
      "maxTokens": 50000,
      "temperature": 0.2
    },
    "research": {
      "provider": "mcp", 
      "modelId": "claude-3-5-sonnet-20241022",
      "maxTokens": 8700,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "anthropic",
      "modelId": "claude-3-5-sonnet-20241022"
    }
  }
}
```

### Available Models

**MCP Provider Models:**

- **`claude-3-5-sonnet-20241022`** - High-performance model for general tasks
  - **SWE Score**: 0.49
  - **Features**: Text + Object generation

- **`claude-3-opus-20240229`** - Enhanced reasoning model for complex tasks  
  - **SWE Score**: 0.725
  - **Features**: Text + Object generation

- **`mcp-sampling`** - General text generation using MCP client sampling
  - **SWE Score**: null
  - **Roles**: Supports main, research, and fallback roles
  - **SWE Score**: 0.49
  - **Cost**: $0 (session-based)
  - **Max Tokens**: 200,000
  - **Supported Roles**: main, research, fallback
  - **Features**: Text + Object generation

- **`claude-3-opus-20240229`** - Enhanced reasoning model for complex tasks  
  - **SWE Score**: 0.725
  - **Cost**: $0 (session-based)
  - **Max Tokens**: 200,000
  - **Supported Roles**: main, research, fallback
  - **Features**: Text + Object generation

**Basic MCP Provider Models:**

- **`mcp-sampling`** - General text generation using MCP client sampling
- **`mcp-sampling`** - General text generation using MCP client sampling
  - **SWE Score**: null
  - **Roles**: Supports main, research, and fallback roles

### Model ID Format

MCP model IDs use a simple format:

- **`claude-3-5-sonnet-20241022`** - Uses Claude 3.5 Sonnet via MCP sampling
- **`claude-3-opus-20240229`** - Uses Claude 3 Opus via MCP sampling  
- **`mcp-sampling`** - Uses MCP client's sampling capability for text generation

## Session Requirements

The MCP provider requires an active MCP session with sampling capabilities:

```javascript
session: {
  clientCapabilities: {
    sampling: {} // Client supports sampling requests
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

### Provider Architecture
**MCPProvider** (`mcp-server/src/providers/mcp-provider.js`)
   - Modern AI SDK-compliant provider for Task Master's MCP server
   - Auto-registers when MCP sessions connect to Task Master
   - Enables Task Master to use MCP sessions for AI operations
   - Supports both text generation and structured object generation

### Auto-Registration Process

When running as an MCP server, Task Master automatically:

```javascript
// On MCP session connect
server.on("connect", (event) => {
  // Check session capabilities
  if (session.clientCapabilities?.sampling) {
    // Create and register MCP provider
    const mcpProvider = new MCPProvider();
    mcpProvider.setSession(session);
    
    // Auto-register with provider registry
    providerRegistry.registerProvider('mcp', mcpProvider);
  }
});
```

This enables seamless self-referential AI operations within MCP contexts.

### Provider Pattern Integration

The MCP provider follows the same pattern as other providers:

```javascript
class MCPProvider extends BaseAIProvider {
  // Implements generateText, generateObject
  // Uses session context instead of API keys
  // Maps operations to MCP sampling requests
}
```

### Session Detection

The provider automatically detects MCP sampling capability when sessions connect:

```javascript
// On MCP session connect
if (session.clientCapabilities?.sampling) {
  // Auto-register MCP provider for use
  const mcpProvider = new MCPProvider();
  mcpProvider.setSession(session);
}
```

### Sampling Integration

AI operations use MCP sampling with different levels of support:

- `generateText()` → MCP `requestSampling()` with messages (2-minute timeout) ✅ **Full Support**
- `streamText()` → **Limited/No Support** ⚠️ See streaming limitations below
- `generateObject()` → MCP `requestSampling()` with JSON schema instructions (2-minute timeout) ✅ **Full Support**

**Timeout Configuration**: All MCP sampling requests use a 2-minute (120,000ms) timeout to accommodate complex AI operations.

#### Streaming Text Limitations ⚠️

**Important**: The MCP provider has **no support** for text streaming:

**MCPProvider**:
- **❌ No Streaming Support**: Throws error "MCP Provider does not support streaming text, use generateText instead"  
- **Solution**: Always use `generateText()` instead of `streamText()` with this provider

**Recommendation**: For streaming functionality, configure a non-MCP fallback provider (like Anthropic or OpenAI) in your fallback role.

### Error Handling

The MCP provider includes comprehensive error handling:

- Session validation errors (checks for `clientCapabilities.sampling`)
- MCP sampling request failures
- JSON parsing errors (for structured output)
- Automatic fallback to other providers

### Best Practices

### 1. Configure Fallbacks

Always configure a non-MCP fallback provider, especially for streaming operations:

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

### 2. Avoid Streaming with MCP

**Do not use `streamTextService()` with MCP provider**. Use `generateTextService()` instead:

```javascript
// ❌ Don't do this with MCP provider
const result = await streamTextService({
  role: 'main', // MCP provider
  session: mcpSession,
  prompt: 'Generate content'
});

// ✅ Do this instead
const result = await generateTextService({
  role: 'main', // MCP provider
  session: mcpSession,
  prompt: 'Generate content'
});
```

### 3. Session Management

Ensure your MCP session remains active throughout Task Master operations:

```javascript
// Check session health before operations
if (!session || !session.capabilities) {
  throw new Error('MCP session not available');
}
```

### 4. Tool Availability

Verify required capabilities are available in your MCP session:

```javascript
// Check session health and capabilities
if (session && session.clientCapabilities && session.clientCapabilities.sampling) {
  console.log('MCP sampling available');
} else {
  console.log('MCP sampling not available');
}
```

### 5. Error Recovery

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
   - Check that you're running in an MCP environment

2. **"MCP session must have client sampling capabilities"**
   - Check that `session.clientCapabilities.sampling` exists
   - Verify session has `requestSampling()` method
   - Ensure MCP client supports sampling feature

3. **"MCP Provider does not support streaming text, use generateText instead"**
   - **Common Error**: Occurs when calling `streamTextService()` with MCP provider
   - **Solution**: Use `generateTextService()` instead of `streamTextService()`
   - **Alternative**: Configure a non-MCP fallback provider for streaming operations

4. **"MCP sampling failed"** or **Timeout errors**
   - Check MCP client is responding to sampling requests
   - Verify session is still active and connected
   - Consider if request complexity requires longer processing time
   - Check for network connectivity issues

5. **"Model ID is required for MCP Remote Provider"**
   - Ensure `modelId` is specified in configuration
   - Use `mcp-sampling` as the standard model ID
   - Verify provider configuration is properly loaded

6. **Auto-registration failures**
   - Check that MCP session has required sampling capabilities
   - Verify server event listeners are properly configured
   - Look for provider registry initialization issues

### Streaming-Related Issues

**Error**: `streamTextService()` calls fail with MCP provider
**Cause**: MCP provider has no streaming support
**Solutions**:
- Use `generateTextService()` for all MCP-based text generation
- Configure non-MCP fallback providers for streaming requirements
- Check your provider configuration to ensure fallback chain includes streaming-capable providers

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
import { MCPProvider } from './mcp-server/src/providers/mcp-provider.js';

// Test session capabilities
if (session && session.clientCapabilities && session.clientCapabilities.sampling) {
  console.log('MCP sampling available');
  
  // Test provider creation
  const provider = new MCPProvider();
  provider.setSession(session);
  console.log('MCP provider created successfully');
} else {
  console.log('MCP session lacks required capabilities');
}
```

## Integration with Development Tools

### VS Code with MCP Extension

When using Task Master in VS Code with MCP support:

1. Configure Task Master MCP server in your `.vscode/mcp.json`
2. Set MCP provider as main/research in `.taskmaster/config.json`
3. Benefit from integrated AI assistance within your development workflow
4. Use Task Master tools directly from VS Code's MCP interface

**Example VS Code MCP Configuration:**
```json
{
  "servers": {
    "task-master-dev": {
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "cwd": "/path/to/your/task-master-project",
      "env": {
        "NODE_ENV": "development",
        "ANTHROPIC_API_KEY": "${env:ANTHROPIC_API_KEY}",
        "TASK_MASTER_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

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

### API Reference

### MCPProvider Methods

- `generateText(params)` - Generate text using MCP sampling ✅ **Supported**
- `streamText(params)` - Stream text ❌ **Not supported** (throws error)
- `generateObject(params)` - Generate structured objects ✅ **Supported**
- `setSession(session)` - Update provider session
- `validateAuth(params)` - Validate session capabilities
- `getClient()` - Returns null (not applicable for MCP)

### Required Parameters

All MCP operations require:
- `session` - Active MCP session object (auto-provided when registered)
- `modelId` - MCP model identifier (typically "mcp-sampling")
- `messages` - Array of message objects

### Optional Parameters

- `temperature` - Creativity control (if supported by MCP client)
- `maxTokens` - Maximum response length (if supported)
- `schema` - JSON schema for structured output (generateObject only)

## Security Considerations

1. **Session Security**: MCP sessions should be properly authenticated
2. **Server Validation**: Only connect to trusted MCP servers
3. **Data Privacy**: Ensure MCP clients handle data according to your privacy requirements
4. **Error Exposure**: Be careful not to expose sensitive session information in error messages

## Future Enhancements

Planned improvements for MCP provider:

1. **Native Streaming Support** - True streaming for compatible MCP clients (requires MCP protocol updates)
2. **Enhanced Session Monitoring** - Automatic session validation and recovery
3. **Performance Optimization** - Caching and connection pooling
4. **Advanced Error Recovery** - Intelligent retry and fallback strategies

**Note**: True streaming support depends on future MCP protocol enhancements. Current implementation provides text generation without streaming capabilities.
