# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Task Master is a task management system designed for AI-driven development workflows. It helps break down projects into structured tasks with dependencies, priorities, and implementation details. The system enables:

- Task generation from PRD (Product Requirements Document) files
- Task management with dependencies and status tracking
- Integration with AI assistants via MCP (Model Control Protocol)
- Complexity analysis to identify tasks needing further breakdown
- Generation of individual task files from a central tasks.json

## Commands

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Format code
npm run format
```

### Testing

```bash
# Run all tests
npm test

# Run only failing tests
npm run test:fails

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run end-to-end tests
npm run test:e2e
```

## Architecture

The codebase follows a modular architecture with these key components:

1. **CLI Interface**: Entry point in `index.js` providing command-line functionality
2. **MCP Server**: Located in `mcp-server/`, enables integration with AI assistants
3. **Core Functions**: Direct task management implementations in `mcp-server/src/core/direct-functions/`
4. **Tools**: API wrappers around core functions in `mcp-server/src/tools/`
5. **AI Providers**: Adapters for different AI services in `src/ai-providers/`

## Key Concepts

- **Task Structure**: Each task has an id, title, description, status, dependencies, priority, details, and test strategy
- **MCP Integration**: The system integrates with Model Control Protocol to work with AI assistants
- **Direct Functions Pattern**: Core functionality is implemented as "direct" functions wrapped by API/tool interfaces
- **Tasks.json**: Central store for all task data, which can be transformed into individual task files

## Code Patterns

- Uses ES Modules throughout with `"type": "module"` in package.json
- Modular design with clean separation between core functionality and interfaces
- Supports multiple AI providers through adapter pattern
- Standardized task structure with dependencies, priorities, and subtasks