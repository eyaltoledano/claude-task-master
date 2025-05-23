# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development & Testing
```bash
# Install dependencies
npm install

# Run tests
npm test

# Run specific tests
npm test -- tests/unit/commands.test.js

# Run tests with coverage
npm test:coverage

# Run tests in watch mode
npm test:watch

# Run end-to-end tests
npm test:e2e

# Format code
npm run format

# Check formatting
npm run format-check

# Run the MCP server
npm run mcp-server
```

### MCP Inspector
```bash
# Run MCP inspector
npm run inspector
```

## Project Structure

Task Master is a task management system for AI-driven development with Claude, designed to work seamlessly with Cursor AI and other MCP-compatible editors.

### Core Components

1. **CLI Interface**: Commands are processed through `scripts/modules/commands.js` which uses commander.js.

2. **Task Master Core**: Core functionality is in `mcp-server/src/core/task-master-core.js` which centralizes all direct function implementations.

3. **MCP Integration**: The MCP server in `mcp-server/server.js` allows IDE integration via the Model Control Protocol.

4. **AI Service Layer**: The unified AI service layer in `scripts/modules/ai-services-unified.js` handles communication with different AI providers.

5. **Task Management**: Task management functions are in `scripts/modules/task-manager.js` and its submodules.

### Key Architecture Patterns

1. **Command Pattern**: Each CLI command is registered in `registerCommands()` function in `commands.js` and maps to core functions.

2. **Direct Functions**: Core functionality is implemented in direct function modules in `mcp-server/src/core/direct-functions/`.

3. **MCP Tools**: Tool implementations in `mcp-server/src/tools/` register functions with the MCP server.

4. **Source Parameter Pattern**: Core functions check a `source` parameter to determine behavior (CLI vs MCP).

5. **Provider Abstraction**: AI service layer abstracts different AI providers through a unified interface.

### Data Flow

1. User command (CLI or MCP) → 
2. Command handler or MCP tool → 
3. Core function implementation → 
4. Task data processing → 
5. AI service communication (if needed) → 
6. File system operations → 
7. Response formatting

## API Keys and Configuration

Task Master requires API keys for AI providers:
- `ANTHROPIC_API_KEY` - Required for Claude API
- `PERPLEXITY_API_KEY` - Optional for research capabilities
- `OPENAI_API_KEY` - Optional for alternative model support
- `GOOGLE_API_KEY` - Optional for Google AI support
- `MISTRAL_API_KEY` - Optional for Mistral AI support
- `OPENROUTER_API_KEY` - Optional for OpenRouter support
- `XAI_API_KEY` - Optional for XAI support

Model configuration is stored in `.taskmasterconfig` in the project root.

## Important Files

- `mcp-server/src/core/task-master-core.js` - Central module that imports/exports all direct function implementations
- `scripts/modules/ai-services-unified.js` - Unified AI service layer for communicating with different AI providers
- `scripts/modules/commands.js` - CLI command definitions and handlers
- `scripts/modules/task-manager.js` - Core task management functions
- `mcp-server/server.js` - MCP server implementation