# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Run/Test Commands
- Build/Install: `npm install`
- Run tests: `npm test`
- Run single test: `npm test -- tests/unit/specific-file.test.js`
- Test with pattern: `npm test -- -t "pattern to match"`
- Test with coverage: `npm run test:coverage`
- Test in watch mode: `npm run test:watch`

## Code Style Guidelines
- **File Structure**: ES modules with `"type": "module"` in package.json
- **Imports**: Group by module/functionality, import only what's needed
- **Naming**: 
  - kebab-case for CLI command names (`add-task`, not `addTask`)
  - camelCase for variables, functions, and options in code
- **Error Handling**: Use try/catch with proper error messages, early returns for validation
- **Testing**: Mock first, then import (Jest hoisting); clear mocks in beforeEach
- **Modules**: Maintain clear separation between UI, commands, task-manager, dependency-manager
- **Documentation**: Include JSDoc comments for functions with @param and @returns tags

## Roo Code Integration
Roo Code resources are available in the `.roo` directory:

- **Roles**: `.roo/roles/*.md` - Expertise areas for different parts of the codebase
- **Boomerangs**: `.roo/boomerangs/*.md` - Templates for implementing specific functionality

When working on this codebase, please reference these resources for guidance on architecture, patterns, and best practices.