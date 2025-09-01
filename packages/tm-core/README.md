# @task-master/tm-core

Core library for Task Master AI - providing task management and orchestration capabilities with TypeScript support.

## Overview

`tm-core` is the foundational library that powers Task Master AI's task management system. It provides a comprehensive set of tools for creating, managing, and orchestrating tasks with AI integration.

## Features

- **TypeScript-first**: Built with full TypeScript support and strict type checking
- **Dual Format**: Supports both ESM and CommonJS with automatic format detection
- **Modular Architecture**: Clean separation of concerns with dedicated modules for different functionality
- **AI Provider Integration**: Pluggable AI provider system for task generation and management
- **Flexible Storage**: Abstracted storage layer supporting different persistence strategies
- **Task Parsing**: Advanced parsing capabilities for various task definition formats
- **Error Handling**: Comprehensive error system with specific error types
- **Testing**: Complete test coverage with Jest and TypeScript support

## Installation

```bash
npm install @task-master/tm-core
```

## Usage

### Basic Usage

```typescript
import { generateTaskId, PlaceholderTask } from '@task-master/tm-core';

// Generate a unique task ID
const taskId = generateTaskId();

// Create a task (coming soon - full implementation)
const task: PlaceholderTask = {
  id: taskId,
  title: 'My Task',
  status: 'pending',
  priority: 'medium'
};
```

### Modular Imports

You can import specific modules to reduce bundle size:

```typescript
// Import types only
import type { TaskId, TaskStatus } from '@task-master/tm-core/types';

// Import utilities
import { generateTaskId, formatDate } from '@task-master/tm-core/utils';

// Import providers (AI providers coming soon)
// import { AIProvider } from '@task-master/tm-core/providers';

// Import storage
import { PlaceholderStorage } from '@task-master/tm-core/storage';

// Import parsers
import { PlaceholderParser } from '@task-master/tm-core/parser';

// Import errors
import { TmCoreError, TaskNotFoundError } from '@task-master/tm-core/errors';
```

## Architecture

The library is organized into several key modules:

- **types/**: TypeScript type definitions and interfaces
- **providers/**: AI provider implementations for task generation
- **storage/**: Storage adapters for different persistence strategies
- **parser/**: Task parsing utilities for various formats
- **utils/**: Common utility functions and helpers
- **errors/**: Custom error classes and error handling

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Scripts

- `build`: Build the library for both ESM and CJS formats
- `build:watch`: Build in watch mode for development
- `test`: Run the test suite
- `test:watch`: Run tests in watch mode
- `test:coverage`: Run tests with coverage reporting
- `lint`: Lint TypeScript files
- `lint:fix`: Lint and auto-fix issues
- `format`: Format code with Prettier
- `format:check`: Check code formatting
- `typecheck`: Type-check without emitting files
- `clean`: Clean build artifacts
- `dev`: Development mode with watch

## ESM and CommonJS Support

This package supports both ESM and CommonJS formats automatically:

```javascript
// ESM
import { generateTaskId } from '@task-master/tm-core';

// CommonJS
const { generateTaskId } = require('@task-master/tm-core');
```

## Roadmap

This is the initial package structure. The following features are planned for implementation:

### Task 116: TypeScript Types
- [ ] Complete type definitions for tasks, projects, and configurations
- [ ] Zod schema validation
- [ ] Generic type utilities

### Task 117: AI Provider System
- [ ] Base provider interface
- [ ] Anthropic Claude integration
- [ ] OpenAI integration
- [ ] Perplexity integration
- [ ] Provider factory and registry

### Task 118: Storage Layer
- [ ] File system storage adapter
- [ ] Memory storage adapter
- [ ] Storage interface and factory

### Task 119: Task Parser
- [ ] PRD parser implementation
- [ ] Markdown parser
- [ ] JSON task format parser
- [ ] Validation utilities

### Task 120: Utility Functions
- [ ] Task ID generation
- [ ] Date formatting
- [ ] Validation helpers
- [ ] File system utilities

### Task 121: Error Handling
- [ ] Task-specific errors
- [ ] Storage errors
- [ ] Provider errors
- [ ] Validation errors

### Task 122: Configuration System
- [ ] Configuration schema
- [ ] Default configurations
- [ ] Environment variable support

### Task 123: Testing Infrastructure
- [ ] Unit test coverage
- [ ] Integration tests
- [ ] Mock utilities

### Task 124: Documentation
- [ ] API documentation
- [ ] Usage examples
- [ ] Migration guides

### Task 125: Package Finalization
- [ ] Final testing and validation
- [ ] Release preparation
- [ ] CI/CD integration

## Implementation Checklist

### ✅ Task 115: Initialize tm-core Package Structure (COMPLETED)
- [x] Create tm-core directory structure and base configuration files
- [x] Configure build and test infrastructure 
- [x] Create barrel export files for all directories
- [x] Add development tooling and documentation
- [x] Validate package structure and prepare for development

### 🚧 Remaining Implementation Tasks
- [ ] **Task 116**: TypeScript Types - Complete type definitions for tasks, projects, and configurations
- [ ] **Task 117**: AI Provider System - Base provider interface and integrations
- [ ] **Task 118**: Storage Layer - File system and memory storage adapters
- [ ] **Task 119**: Task Parser - PRD, Markdown, and JSON parsers
- [ ] **Task 120**: Utility Functions - Task ID generation, validation helpers
- [ ] **Task 121**: Error Handling - Task-specific and validation errors
- [ ] **Task 122**: Configuration System - Schema and environment support
- [ ] **Task 123**: Testing Infrastructure - Complete unit and integration tests
- [ ] **Task 124**: Documentation - API docs and usage examples
- [ ] **Task 125**: Package Finalization - Release preparation and CI/CD

## Contributing

This package is part of the Task Master AI project. Please refer to the main project's contributing guidelines.

## License

MIT - See the main project's LICENSE file for details.

## Support

For questions and support, please refer to the main Task Master AI documentation.