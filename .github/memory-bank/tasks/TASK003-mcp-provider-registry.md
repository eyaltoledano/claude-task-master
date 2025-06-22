# [TASK003] - MCP Provider Registry Implementation

**Status:** In Progress  
**Added:** June 18, 2025  
**Updated:** June 18, 2025

## Original Request
Extract the MCP provider logic to the `mcp-server`, enabling registration of remote AI providers (including MCP) to a new core registry so they can be used in `ai-services-unified.js`. The logic should keep the existing `PROVIDERS` but, if the selected provider is not present, also check the new registry. The provider registry must be a singleton, initialized as early as possible, and remote providers (like MCP) should be registered on MCP server start. On MCP server initialization, register the MCP SDK server's first session (`server.sessions[0]`) so its `requestSampling` can be called. Once this is in place, stop overloading the `enhancedContext` on `analyzeTaskComplexityDirect` and return the old session object.

## Thought Process

The current architecture of Task Master uses a static provider registry (`PROVIDERS` object) in `ai-services-unified.js` that directly instantiates all available AI provider classes. This works well for direct API providers but has limitations for MCP-based providers that need runtime context.

The challenge is to create a dynamic provider registry that:
1. Maintains backward compatibility with the existing `PROVIDERS` object
2. Allows runtime registration of providers from the MCP server
3. Follows the singleton pattern for consistent global state
4. Is initialized early in the application lifecycle
5. Can seamlessly integrate with the existing provider selection logic

Looking at the code, we see that:
- The `MCPAIProvider` class already exists and functions well
- The `analyzeTaskComplexityDirect` function currently passes context with session data
- The MCP server initializes a FastMCP instance that could be used for provider registration

The solution approach involves:
1. Creating a new `ProviderRegistry` singleton class that extends/wraps the existing `PROVIDERS` system
2. Implementing a remote provider in the MCP server that uses the server's session
3. Registering this remote provider during MCP server initialization
4. Updating `ai-services-unified.js` to check the registry for providers not in `PROVIDERS`
5. Simplifying the context passing in `analyzeTaskComplexityDirect`

This maintains backward compatibility while enabling a more flexible provider architecture.

## Implementation Plan

### Phase 1: Create Provider Registry Singleton
1. **Create the Provider Registry Class**
   - Create `src/provider-registry/index.js` with a singleton pattern
   - Implement methods for registering and retrieving providers
   - Ensure thread safety and proper initialization

2. **Update AI Services Integration**
   - Modify `ai-services-unified.js` to check the registry when a provider isn't found in `PROVIDERS`
   - Keep existing direct imports for backward compatibility
   - Add fallback to registry for dynamic providers

### Phase 2: MCP Server Provider Implementation
1. **Create MCP Remote Provider**
   - Create `mcp-server/src/providers/mcp-remote-provider.js`
   - Implement a provider that uses the MCP server's session for AI operations
   - Ensure it follows the BaseAIProvider interface

2. **Add Provider Registration to MCP Server**
   - Update `mcp-server/src/index.js` to initialize the provider registry
   - Register the MCP remote provider during server startup
   - Use the server's first session for provider operations

### Phase 3: Update Context Handling
1. **Simplify `analyzeTaskComplexityDirect` Context**
   - Remove the enhanced context overloading
   - Return to using the plain session object
   - Update any dependent code that expects the enhanced context

2. **Update Provider Selection Logic**
   - Ensure that provider selection functions check both static and dynamic providers
   - Add logging for provider resolution paths
   - Handle edge cases for session-based providers

### Phase 4: Testing & Documentation
1. **Add Unit Tests**
   - Test provider registry singleton behavior
   - Test MCP remote provider registration and usage
   - Test provider selection with registry fallback

2. **Update Documentation**
   - Document the new provider architecture
   - Update API docs for provider integration
   - Add examples for custom provider registration

## Progress Tracking

**Overall Status:** In Progress - 30%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 3.1 | Create Provider Registry Singleton | Complete | June 18, 2025 | Created singleton implementation in src/provider-registry/index.js |
| 3.2 | Update AI Services Integration | Complete | June 18, 2025 | Added _getProvider function to ai-services-unified.js |
| 3.3 | Create MCP Remote Provider | Complete | June 18, 2025 | Implemented in mcp-server/src/providers/mcp-remote-provider.js |
| 3.4 | Add Provider Registration to MCP Server | Complete | June 18, 2025 | Updated MCP server to register provider on start |
| 3.5 | Simplify Context Handling | In Progress | June 18, 2025 | Started with analyzeTaskComplexityDirect |
| 3.6 | Update Provider Selection Logic | Not Started | June 18, 2025 | Ensure proper provider lookup |
| 3.7 | Add Unit Tests | Not Started | June 18, 2025 | Test new provider architecture |
| 3.8 | Update Documentation | Not Started | June 18, 2025 | Document the changes |

## Progress Log
### June 18, 2025
- Created task documentation and implementation plan
- Analyzed current codebase structure and provider architecture
- Identified key files that need to be modified
- Developed detailed implementation approach for provider registry
- Implemented Provider Registry singleton in src/provider-registry/index.js
- Created MCP Remote Provider in mcp-server/src/providers/mcp-remote-provider.js
- Updated MCP server to initialize registry and register remote provider on startup
- Added provider lookup function in ai-services-unified.js to check both static and dynamic providers
- Started simplifying context handling in analyzeTaskComplexityDirect
