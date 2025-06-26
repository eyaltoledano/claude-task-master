# MCP Sampling Implementation Notes

## Overview

This document provides a comprehensive comparison between the original PR 863 MCP Sampling implementation and our refactored implementation following the claude-code custom-sdk pattern. The refactor represents a significant architectural improvement in code organization, maintainability, and protocol compliance.

## Architecture Comparison

### PR 863: Monolithic Implementation
- **Structure**: Single file implementation (`mcp-server/src/providers/mcp-remote-provider.js`)
- **Pattern**: Direct provider class extending BaseAIProvider
- **Location**: Mixed with MCP server code
- **Approach**: Custom one-off solution

### Our Implementation: Custom SDK Pattern
- **Structure**: Modular architecture with separate concerns
  ```
  src/ai-providers/
  ├── custom-sdk/
  │   └── mcp-sampling/
  │       ├── index.js         # Factory and exports
  │       ├── language-model.js # Core AI SDK implementation
  │       ├── message-converter.js # Message format conversion
  │       ├── errors.js        # Error handling
  │       └── types.js         # Type definitions
  └── mcp-sampling.js          # Provider integration
  ```
- **Pattern**: Follows established claude-code provider pattern
- **Location**: Properly organized within ai-providers structure
- **Approach**: Reusable, maintainable SDK implementation

## Key Architectural Improvements

### 1. Separation of Concerns

**PR 863**: Everything in one file
```javascript
export class MCPRemoteProvider extends BaseAIProvider {
  constructor(server, options = {}) { ... }
  validateAuth(params) { ... }
  requestSampling(...) { ... }
  generateText(params) { ... }
  generateObject(params) { ... }
  // All logic mixed together
}
```

**Our Implementation**: Modular design
```javascript
// Separate files for:
- Type definitions (types.js)
- Error handling (errors.js)
- Message conversion (message-converter.js)
- Core language model (language-model.js)
- Provider integration (mcp-sampling.js)
```

### 2. AI SDK Compatibility

**PR 863**: Custom implementation
- No AI SDK integration
- Custom response formatting
- Manual error handling
- No standard interfaces

**Our Implementation**: Full AI SDK integration
- Implements standard `doGenerate` and `doStream` methods
- Compatible with Vercel AI SDK
- Standardized response formats
- Proper warning generation

### 3. Error Handling

**PR 863**: Basic error handling
```javascript
handleError(operation, error) {
  const errorMessage = error.message || 'Unknown error occurred';
  log('error', `${this.name} ${operation} failed: ${errorMessage}`);
  throw new Error(`${this.name} API error during ${operation}: ${errorMessage}`);
}
```

**Our Implementation**: Sophisticated error system
```javascript
// Dedicated error types with metadata
export function createAPICallError(options) { ... }
export function createAuthenticationError(options) { ... }
export function createTimeoutError(options) { ... }

// Error detection utilities
export function isAuthenticationError(error) { ... }
export function isTimeoutError(error) { ... }
export function getErrorMetadata(error) { ... }
```

### 4. Message Format Conversion

**PR 863**: Inline conversion
```javascript
const mcpMessages = messages.map((msg) => ({
  role: msg.role,
  content: {
    type: 'text',
    text: msg.content
  }
}));
```

**Our Implementation**: Dedicated converter with full support
```javascript
export function convertToMcpSamplingMessages(prompt, mode) {
  // Handles:
  - String prompts
  - Array of messages
  - Prompt objects with system messages
  - Different content types (text, tool calls, etc.)
  - Object generation mode instructions
}
```

### 5. Session Management

**PR 863**: Constructor-based session
```javascript
constructor(server, options = {}) {
  this.server = server;
  this.session = server?.sessions?.[0] || null;
}
```

**Our Implementation**: Settings-based session
```javascript
// Session passed through settings, not constructor
const session = this.settings.session;
// More flexible and follows AI SDK patterns
```

## Model Selection Implementation

### Key Finding: MCP Model Selection

After researching the MCP specification, we discovered that **MCP Sampling does NOT support direct model selection by ID**. Instead, it uses a preference-based system.

### PR 863 Approach
```javascript
// modelId extracted but never used in request
const modelId = params.modelId || this.options.defaultModel;
logger.debug(`Using model: ${modelId}`); // Only for logging

await session.requestSampling({
  messages: mcpMessages,
  systemPrompt: systemPrompt,
  temperature: temperature,
  maxTokens: maxTokens,
  includeContext: 'thisServer'
  // No model information passed
});
```

### Our Implementation (Spec-Compliant)
```javascript
// modelId converted to preferences per MCP spec
if (this.modelId) {
  requestParams.modelPreferences = {
    hints: [{ name: this.modelId }],
    costPriority: this.settings.costPriority ?? 0.5,
    speedPriority: this.settings.speedPriority ?? 0.5,
    intelligencePriority: this.settings.intelligencePriority ?? 0.5
  };
}
```

## Type Safety and Documentation

### PR 863: No type definitions
- No JSDoc types
- No parameter documentation
- Implicit contracts

### Our Implementation: Comprehensive types
```javascript
/**
 * @typedef {Object} McpSamplingSettings
 * @property {Object} [session] - MCP session object
 * @property {number} [timeout=120000] - Request timeout
 * @property {string} [includeContext='thisServer'] - Context mode
 * ... detailed property documentation
 */
```

## Provider Integration

### PR 863: Direct BaseAIProvider extension
```javascript
export class MCPRemoteProvider extends BaseAIProvider {
  getClient() {
    return null; // Not applicable for MCP
  }
}
```

### Our Implementation: Factory pattern
```javascript
export class McpSamplingProvider extends BaseAIProvider {
  getClient(params) {
    return createMcpSampling({
      defaultSettings: {
        session: params.session,
        // Configurable settings
      }
    });
  }
}
```

## Testing Approach

### PR 863: Direct testing
- Tests the provider class directly
- Mocks at the session level
- Limited test coverage

### Our Implementation: Layered testing
- Unit tests for each module
- Integration tests for provider
- Better isolation and coverage
- Follows AI SDK testing patterns

## Benefits of the Refactor

1. **Maintainability**: Modular code is easier to understand and modify
2. **Reusability**: Custom SDK can be used independently
3. **Standards Compliance**: Follows both AI SDK and MCP specifications
4. **Error Handling**: More robust with specific error types
5. **Type Safety**: Comprehensive JSDoc types
6. **Testing**: Better test isolation and coverage
7. **Future-Proof**: Easier to add features like streaming when supported

## Migration Impact

### For Users
- Configuration remains the same
- Better error messages
- Model hints work as expected
- No breaking changes

### For Developers
- Clear separation of concerns
- Easier to debug
- Better code organization
- Follows established patterns

## Recommendations

1. **Keep the custom-sdk pattern** - It's proven successful with claude-code
2. **Document model preferences** - Users should understand hints vs. commands
3. **Monitor MCP updates** - Adapt if specification changes
4. **Consider streaming** - Add when MCP supports it
5. **Add priority configuration** - Allow users to set cost/speed/intelligence priorities

## Conclusion

The refactored implementation represents a significant improvement over PR 863:
- Better architecture following established patterns
- Proper MCP specification compliance
- Improved maintainability and extensibility
- Enhanced error handling and type safety

While PR 863 provided a working implementation, our refactor elevates it to production-quality code that aligns with the project's architectural standards and the MCP protocol specification.

## References

- [MCP Sampling Specification](https://modelcontextprotocol.io/specification/2025-03-26/client/sampling)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- Original PR #863 implementation
- Claude-code provider pattern
- Our improved implementation