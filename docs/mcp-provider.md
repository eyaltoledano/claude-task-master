# MCP Provider Implementation

## Overview

The MCP Provider creates a modern AI SDK-compliant custom provider that integrates with the existing Task Master MCP server infrastructure. This provider enables AI operations through MCP session sampling while following modern AI SDK patterns and **includes full support for structured object generation (generateObject)** for schema-driven features like PRD parsing and task creation.

## Architecture

### Components

1. **MCPProvider** (`mcp-server/src/providers/mcp-provider.js`)
   - Main provider class following Claude Code pattern
   - Session-based provider (no API key required)
   - Registers with provider registry on MCP server connect

2. **AI SDK Implementation** (`mcp-server/src/custom-sdk/`)
   - `index.js` - Provider factory function
   - `language-model.js` - LanguageModelV1 implementation with **doGenerateObject support**
   - `message-converter.js` - Format conversion utilities
   - `json-extractor.js` - **NEW**: Robust JSON extraction from AI responses
   - `schema-converter.js` - **NEW**: Schema-to-instructions conversion utility
   - `errors.js` - Error handling and mapping

3. **Integration Points**
   - MCP Server registration (`mcp-server/src/index.js`)
   - AI Services integration (`scripts/modules/ai-services-unified.js`)
   - Model configuration (`scripts/modules/supported-models.json`)

### Session Flow

```
MCP Client Connect → MCP Server → registerRemoteProvider()
                                        ↓
                           MCPRemoteProvider (existing)
                           MCPProvider 
                                        ↓
                               Provider Registry
                                        ↓
                               AI Services Layer
                                        ↓
                        Text Generation + Object Generation
```

## Implementation Details

### Provider Registration

The MCP server registers **both** providers when a client connects:

```javascript
// mcp-server/src/index.js
registerRemoteProvider(session) {
  if (session?.clientCapabilities?.sampling) {
    // Register existing provider
    // Register unified MCP provider
    const mcpProvider = new MCPProvider();
    mcpProvider.setSession(session);
    
    const providerRegistry = ProviderRegistry.getInstance();
    providerRegistry.registerProvider('mcp', mcpProvider);
  }
}
```

### AI Services Integration

The AI services layer includes the new provider:

```javascript
// scripts/modules/ai-services-unified.js
const PROVIDERS = {
  // ... other providers
  'mcp': () => {
    const providerRegistry = ProviderRegistry.getInstance();
    return providerRegistry.getProvider('mcp');
  }
};
```

### Message Conversion

The provider converts between AI SDK and MCP formats:

```javascript
// AI SDK prompt → MCP sampling format
const { messages, systemPrompt } = convertToMCPFormat(options.prompt);

// MCP response → AI SDK format
const result = convertFromMCPFormat(response);
```

## Structured Object Generation (generateObject)

### Overview

The MCP Provider includes full support for structured object generation, enabling schema-driven features like PRD parsing, task creation, and any operations requiring validated JSON outputs.

### Architecture

The generateObject implementation includes:

1. **Schema-to-Instructions Conversion** (`schema-converter.js`)
   - Converts Zod schemas to natural language instructions
   - Generates example outputs to guide AI responses
   - Handles complex nested schemas and validation requirements

2. **JSON Extraction Pipeline** (`json-extractor.js`)
   - Multiple extraction strategies for robust JSON parsing
   - Handles code blocks, malformed JSON, and various response formats
   - Fallback mechanisms for maximum reliability

3. **Validation System**
   - Complete schema validation using Zod
   - Detailed error reporting for failed validations
   - Type-safe object generation

### Implementation Details

#### doGenerateObject Method

The `MCPLanguageModel` class implements the AI SDK's `doGenerateObject` method:

```javascript
async doGenerateObject({ schema, objectName, prompt, ...options }) {
  // Convert schema to instructions
  const instructions = convertSchemaToInstructions(schema, objectName);
  
  // Enhance prompt with structured output requirements
  const enhancedPrompt = enhancePromptForObjectGeneration(prompt, instructions);
  
  // Generate response via MCP sampling
  const response = await this.doGenerate({ prompt: enhancedPrompt, ...options });
  
  // Extract and validate JSON
  const extractedJson = extractJsonFromResponse(response.text);
  const validatedObject = schema.parse(extractedJson);
  
  return {
    object: validatedObject,
    usage: response.usage,
    finishReason: response.finishReason
  };
}
```

#### AI SDK Compatibility

The provider includes required properties for AI SDK object generation:

```javascript
class MCPLanguageModel {
  get defaultObjectGenerationMode() {
    return 'tool';
  }
  
  get supportsStructuredOutputs() {
    return true;
  }
  
  // ... doGenerateObject implementation
}
```

### Usage Examples

#### PRD Parsing

```javascript
import { z } from 'zod';

const taskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  dependencies: z.array(z.number()).optional()
});

const result = await generateObject({
  model: mcpModel,
  schema: taskSchema,
  prompt: 'Parse this PRD section into a task: [PRD content]'
});

console.log(result.object); // Validated task object
```

#### Task Creation

```javascript
const taskCreationSchema = z.object({
  task: z.object({
    title: z.string(),
    description: z.string(),
    details: z.string(),
    testStrategy: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    dependencies: z.array(z.number()).optional()
  })
});

const result = await generateObject({
  model: mcpModel,
  schema: taskCreationSchema,
  prompt: 'Create a comprehensive task for implementing user authentication'
});
```

### Error Handling

The implementation provides comprehensive error handling:

- **Schema Validation Errors**: Detailed Zod validation messages
- **JSON Extraction Failures**: Fallback strategies and clear error reporting
- **MCP Communication Errors**: Proper error mapping and recovery
- **Timeout Handling**: Configurable timeouts for long-running operations

### Testing

The generateObject functionality is fully tested:

```bash
# Test object generation
npm test -- --grep "generateObject"

# Test with actual MCP session
node test-object-generation.js
```

### Supported Features

✅ **Schema Conversion**: Zod schemas → Natural language instructions  
✅ **JSON Extraction**: Multiple strategies for robust parsing  
✅ **Validation**: Complete schema validation with error reporting  
✅ **Error Recovery**: Fallback mechanisms for failed extractions  
✅ **Type Safety**: Full TypeScript support with inferred types  
✅ **AI SDK Compliance**: Complete LanguageModelV1 interface implementation  

## Usage

### Configuration

Add to supported models configuration:

```json
{
  "mcp": [
    {
      "id": "claude-3-5-sonnet-20241022",
      "swe_score": 0.623,
      "cost_per_1m_tokens": { "input": 0, "output": 0 },
      "allowed_roles": ["main", "fallback", "research"],
      "max_tokens": 200000
    }
  ]
}
```

### CLI Usage

```bash
# Set provider for main role
tm models set-main --provider mcp --model claude-3-5-sonnet-20241022

# Use in task operations
tm add-task "Create user authentication system"
```

### Programmatic Usage

```javascript
const provider = registry.getProvider('mcp');
if (provider && provider.hasValidSession()) {
  const client = provider.getClient({ temperature: 0.7 });
  const model = client({ modelId: 'claude-3-5-sonnet-20241022' });
  
  const result = await model.doGenerate({
    prompt: [
      { role: 'user', content: 'Hello!' }
    ]
  });
}
```

## Testing

### Component Tests

```bash
# Test individual components
node test-mcp-components.js
```

### Integration Testing

1. Start MCP server
2. Connect Claude client
3. Verify both providers are registered
4. Test AI operations through mcp provider

### Validation Checklist

- ✅ Provider creation and initialization
- ✅ Registry integration
- ✅ Session management
- ✅ Message conversion
- ✅ Error handling
- ✅ AI Services integration
- ✅ Model configuration

## Key Benefits

1. **AI SDK Compliance** - Full LanguageModelV1 implementation
2. **Session Integration** - Leverages existing MCP session infrastructure
3. **Registry Pattern** - Uses provider registry for discovery
4. **Backward Compatibility** - Coexists with existing MCPRemoteProvider
5. **Future Ready** - Supports AI SDK features and patterns

## Troubleshooting

### Provider Not Found

```
Error: Provider "mcp" not found in registry
```

**Solution**: Ensure MCP server is running and client is connected

### Session Errors

```
Error: MCP Provider requires active MCP session
```

**Solution**: Check MCP client connection and session capabilities

### Sampling Errors

```
Error: MCP session must have client sampling capabilities
```

**Solution**: Verify MCP client supports sampling operations

## Next Steps

1. **Performance Optimization** - Add caching and connection pooling
2. **Enhanced Streaming** - Implement native streaming if MCP supports it
3. **Tool Integration** - Add support for function calling through MCP tools
4. **Monitoring** - Add metrics and logging for provider usage
5. **Documentation** - Update user guides and API documentation
