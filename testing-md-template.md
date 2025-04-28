# Task Master Testing Guide

## Testing Philosophy

We follow these key principles:
- **Test behavior, not implementation details**
- **Maintain a clear testing pyramid**
- **Use consistent patterns across the test suite**
- **Avoid brittle tests that break with refactoring**

## Test Types

### Unit Tests (`/tests/unit`)

Unit tests verify that individual components work in isolation.

**Key Characteristics:**
- Fast execution (<10ms per test)
- Mock external dependencies 
- Test single functions or small components
- Focus on logic, not file system operations

**Example:**
```javascript
// Good: Testing logic with clean mocks
describe('resolveTasksOutputPath', () => {
  test('returns default path when no explicit path provided', () => {
    // Arrange
    const mockFs = { existsSync: jest.fn().mockReturnValue(true) };
    const mockLog = { info: jest.fn() };
    const projectRoot = '/project';
    
    // Act
    const result = resolveTasksOutputPathWithDeps(
      projectRoot, 
      null, 
      mockLog,
      mockFs
    );
    
    // Assert
    expect(result).toBe('/project/.taskmaster/tasks/tasks.json');
  });
});
```

### Integration Tests (`/tests/integration`)

Integration tests verify that components work together correctly.

**Key Characteristics:**
- Mock minimal external dependencies
- Test interactions between modules
- May use file system fixtures
- Verify correct state transitions

**Example:**
```javascript
// Good: Integration test with minimal mocking
describe('Task file generation', () => {
  test('generates task files from tasks.json', async () => {
    // Setup test fixtures directory with real files
    const fixtureDir = setupTestFixture('generate-task-files');
    
    // Act
    await generateTaskFiles(fixtureDir);
    
    // Assert - Check actual generated files
    expect(fs.existsSync(path.join(fixtureDir, '.taskmaster/tasks/task_001.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(fixtureDir, '.taskmaster/tasks/task_001.txt'), 'utf8'))
      .toContain('Task Title');
  });
});
```

### E2E Tests (`/tests/e2e`)

End-to-end tests verify that the whole system works together from the CLI interface.

**Key Characteristics:**
- Test the CLI as a user would
- Use actual file system (in temp directories)
- Execute real commands
- Verify observable results

**Example:**
```javascript
// Good: E2E test with CLI execution
describe('Task Master CLI', () => {
  test('init command creates correct structure', async () => {
    // Create temp directory for test
    const tempDir = createTempProjectDir();
    
    // Act - Run actual CLI command
    const result = await execCLI(['init', '--yes'], { cwd: tempDir });
    
    // Assert
    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(tempDir, '.taskmaster'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.taskmaster/scripts'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.taskmaster/tasks'))).toBe(true);
  });
});
```

## Mocking Guidelines

### Dependency Injection

Prefer dependency injection for mocking over direct module mocks:

```javascript
// GOOD: Function receives dependencies, easy to test
export function findTasksJsonPath(args, log, dependencies = { fs, path }) {
  const { fs, path } = dependencies;
  // Use fs and path from dependencies
}

// BAD: Direct imports, hard to mock consistently
import fs from 'fs';
import path from 'path';
export function findTasksJsonPath(args, log) {
  // Direct use of fs and path
}
```

### Mocking Approaches

1. **Function-level mocking**: Pass mock functions directly to the system under test
2. **jest.mock**: Use for module-level mocking, but keep it simple
3. **Mock factories**: Create consistent mock objects for common dependencies

### Mocking File System

Use the `memfs` package for file system mocking when possible:

```javascript
import { fs as memfs, vol } from 'memfs';

// Setup a virtual file system
vol.fromJSON({
  '/project/.taskmaster/tasks.json': '{"tasks": []}',
  '/project/.taskmaster/scripts/prd.txt': 'Requirements'
}, '/');

// Test with memfs instead of mock implementations
const result = findTasksJsonPath({ projectRoot: '/project' }, console, { fs: memfs });
```

## Test Fixtures

Store test fixtures in `/tests/fixtures` directory:

```
/tests
  /fixtures
    /generate-task-files
      tasks.json
    /parse-prd
      prd.txt
```

Load fixtures with helper functions:

```javascript
// Helper function to setup test fixtures
function setupTestFixture(fixtureName) {
  const fixtureDir = path.join(os.tmpdir(), `tm-test-${Date.now()}`);
  fs.mkdirSync(fixtureDir, { recursive: true });
  
  // Copy fixture files to temp dir
  const sourceDir = path.join(__dirname, '../fixtures', fixtureName);
  copyDirSync(sourceDir, fixtureDir);
  
  return fixtureDir;
}
```

## Test Naming Conventions

Follow this pattern:
- Test file: `[module-name].test.js`
- Test suite: `describe('[feature or component]', ...)`
- Test case: `test('should [expected behavior]', ...)`

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only e2e tests
npm run test:e2e

# Run specific test file
npm test -- path/to/test.js
```

## Debugging Tests

```bash
# Run tests in debug mode
npm run test:debug

# Run specific test with increased timeout
npm test -- --testTimeout=10000 path/to/test.js
```

## Adding New Tests

When adding new tests:

1. Identify the appropriate test type (unit, integration, e2e)
2. Follow the existing patterns for that test type
3. Ensure tests are independent and don't rely on global state
4. Add any needed fixtures to the fixtures directory
5. Document any special setup requirements

## Common Testing Patterns

### Testing File System Operations

```javascript
// Example of testing file operations safely
test('should create directory when it does not exist', async () => {
  // Setup
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const targetDir = path.join(tempDir, 'new-dir');
  
  try {
    // Act
    ensureDirectoryExists(targetDir);
    
    // Assert
    expect(fs.existsSync(targetDir)).toBe(true);
    expect(fs.statSync(targetDir).isDirectory()).toBe(true);
  } finally {
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

### Testing CLI Commands

```javascript
// Example of testing CLI commands
test('should display help text', async () => {
  const result = await execCLI(['--help']);
  expect(result.stdout).toContain('Usage:');
  expect(result.exitCode).toBe(0);
});
```

### Testing Error Handling

```javascript
// Example of testing error handling
test('should throw error when file not found', () => {
  expect(() => {
    readConfigFile('/non-existent-file.json');
  }).toThrow(/not found/i);
});
```

## Skipped and TODO Tests

If a test must be skipped:

1. Mark with `test.skip` (not `xit` or `it.skip`)
2. Add a comment explaining why it's skipped
3. Create an issue to address the skipped test
4. Add the issue number to the comment

```javascript
// SKIPPED: File system permissions issues in CI - Issue #123
test.skip('should handle permission errors', () => {
  // Test implementation
});
```
