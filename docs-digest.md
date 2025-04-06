# docs-digest.md

This file provides guidance to Roo Code when working with code in this repository.

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

## Application Architecture

The Task Master CLI is built using a modular architecture with the following key modules:

1. **commands.js**: Command handling using Commander.js
   - Defines and registers CLI commands
   - Parses command-line arguments and options
   - Invokes appropriate functions from other modules

2. **task-manager.js**: Task data management
   - Manages task CRUD operations
   - Handles PRD parsing using AI
   - Implements task expansion and complexity analysis
   - Updates task statuses and properties

3. **dependency-manager.js**: Dependency management
   - Manages task dependencies (adding, removing, validating)
   - Prevents circular dependencies
   - Fixes invalid dependency relationships

4. **ui.js**: User interface components
   - Displays formatted task information
   - Uses chalk for colored output
   - Manages loading indicators and progress reporting

5. **utils.js**: Utility functions
   - Provides global configuration
   - Implements logging and file operations
   - Offers helper functions for task operations

## Command Structure Standards

- Use kebab-case for command names (`analyze-complexity`)
- Keep action handlers concise and delegate to appropriate modules
- Include validation for required parameters
- Provide clear success/error feedback

Command template:
```javascript
programInstance
  .command('command-name')
  .description('Clear description')
  .option('-s, --short-option <value>', 'Option description', 'default')
  .action(async (options) => {
    // Validate inputs, delegate to core modules
  });
```

## Testing Guidelines

- **Test Organization**:
  - Unit tests in `tests/unit/`
  - Fixtures in `tests/fixtures/`
  - Jest configuration in `jest.config.js`

- **Mocking Approach**:
  - Mock modules before importing them (Jest hoisting)
  - Create test-specific fixtures
  - Use `jest.clearAllMocks()` in beforeEach
  - Test both success and error paths

- **Module Testing**:
  - Mock file operations to avoid real file system changes
  - Test tasks, subtasks, and edge cases
  - Verify function behavior with in-memory data

Example:
```javascript
// Mock setup (before imports)
jest.mock('../../scripts/modules/utils.js');

// Import modules after mocks
import { functionToTest } from '../../scripts/modules/module-name.js';

describe('Feature Name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should behave as expected', () => {
    // Test implementation
  });
});
```

## Adding New Features

When adding new commands:
1. Follow the kebab-case naming convention
2. Add the command to `commands.js` using the template pattern
3. Implement core logic in the appropriate module (task-manager, dependency-manager)
4. Add tests for the new functionality
5. Update documentation if needed

## Common Patterns

- Use try/catch for error handling with user-friendly messages
- Validate required parameters early with clear error messages
- Group related commands together in the code
- Extract core functionality to appropriate modules
- Follow consistent option naming across commands