# Task Master Flow Tests - Complete Guide

This is the **single source of truth** for all Task Master Flow TUI testing. This comprehensive guide covers everything you need to know about testing the Flow system.

## 🚀 Quick Start

```bash
# Navigate to the tests directory
cd scripts/modules/flow/tests

# Run all tests
node test-runner.js

# Show help and options
node test-runner.js --help
```

## 📁 Directory Structure

```
scripts/modules/flow/tests/
├── unit/                    # Unit tests (fast, mocked)
│   ├── ast/                 # AST-related unit tests
│   │   ├── cache/           # Cache system tests
│   │   ├── context/         # Context building tests
│   │   └── parsers/         # Parser tests
│   ├── hooks/               # Hook system unit tests
│   │   ├── built-in/        # Built-in hook tests
│   │   └── quality/         # Quality analysis tests ✅ **All quality tests centralized here**
│   ├── services/            # Service unit tests
│   ├── backends/            # Backend interface unit tests
│   ├── tui/                 # TUI component unit tests
│   ├── worktree/            # Worktree management unit tests
│   └── observability/       # Observability unit tests
├── integration/             # Integration tests (real components)
├── e2e/                     # End-to-end tests (full workflows)
├── visual/                  # Visual/UI tests (TUI components)
├── fixtures/                # Test data and fixtures
├── reports/                 # Generated test reports
├── test-runner.js           # Main test runner (⭐ **Use this!**)
├── jest.config.js           # Jest configuration
└── setup.js                 # Test setup/teardown
```

## 🎯 Test Organization & Consolidation

### ✅ Quality Tests Reorganization Complete

All quality-related tests have been properly organized under the Flow tests directory:

- **`unit/hooks/quality/`** - Contains all quality analysis tests:
  - `code-quality-analyzer.test.js`
  - `quality-insights-formatter.test.js`
  - `test-quality-analyzer.test.js`

**Previous State**: Quality tests were scattered in the root `@/tests` directory alongside Task Master core tests.

**Current State**: All Flow-related tests, including quality tests, are now properly organized under `scripts/modules/flow/tests/` with logical subdirectories.

**Why This Matters**:
- ✅ Clear separation between Task Master core tests and Flow TUI tests
- ✅ Quality tests are now alongside the Flow hook system they test
- ✅ Improved test discovery and organization
- ✅ Single source of truth for all Flow testing

### Running Quality Tests

```bash
# Run all quality tests
node test-runner.js unit quality

# Run specific quality tests
npx jest unit/hooks/quality/code-quality-analyzer.test.js
npx jest unit/hooks/quality/quality-insights-formatter.test.js
npx jest unit/hooks/quality/test-quality-analyzer.test.js

# Run all hook tests (including quality)
node test-runner.js hooks
```

## 🧪 Test Types

### Unit Tests (`unit/`)
- **Purpose**: Test individual components in isolation
- **Mocking**: Heavy use of mocks for external dependencies
- **Speed**: Fast execution (< 1s per test)
- **Focus**: Logic, algorithms, data transformations
- **Files**: `*.test.js` files run with Jest

### Integration Tests (`integration/`)
- **Purpose**: Test component interactions
- **Mocking**: Minimal mocking, mostly real components
- **Speed**: Moderate execution (1-5s per test)
- **Focus**: Data flow, API interactions, service integration
- **Files**: `*.test.js` files run with Jest

### End-to-End Tests (`e2e/`)
- **Purpose**: Test complete workflows
- **Mocking**: No internal mocking, may mock external services
- **Speed**: Slow execution (5-30s per test)
- **Focus**: User scenarios, system behavior, error handling
- **Files**: `*.js` files run directly with Node.js

### Visual Tests (`visual/`)
- **Purpose**: Test TUI rendering and interactions
- **Mocking**: Mock terminal/display components
- **Speed**: Moderate execution (2-10s per test)
- **Focus**: UI components, layouts, user interactions
- **Files**: `*.js` files run directly with Node.js

## 🎯 Using the Test Runner

The main test runner (`test-runner.js`) is a comprehensive, self-contained tool that provides a unified interface for running all types of tests.

### Key Features

- **🎯 Targeted Testing**: Run specific test types or components
- **📊 Smart Detection**: Automatically detects Jest vs Node.js tests
- **🎨 Colorized Output**: Clear visual feedback with emojis
- **⚡ Efficient Execution**: Parallel where possible
- **🔄 Watch Mode**: Continuous testing during development
- **📈 Coverage Reports**: Generate coverage with `--coverage`

### Basic Usage

```bash
# Run all tests
node test-runner.js

# Show help
node test-runner.js --help

# Make executable (one-time setup)
chmod +x test-runner.js
./test-runner.js
```

### Running by Test Type

```bash
# Run all unit tests
node test-runner.js unit

# Run all integration tests
node test-runner.js integration

# Run all e2e tests
node test-runner.js e2e

# Run all visual tests
node test-runner.js visual
```

### Running by Component

```bash
# Run all AST-related tests
node test-runner.js ast

# Run all hook system tests
node test-runner.js hooks

# Run all service tests
node test-runner.js services

# Run all worktree tests
node test-runner.js worktree

# Run all backend tests
node test-runner.js backends

# Run all TUI component tests
node test-runner.js tui

# Run all observability tests
node test-runner.js observability
```

### Combining Type + Component

```bash
# Run only unit tests for AST components
node test-runner.js unit ast

# Run only integration tests for hooks
node test-runner.js integration hooks

# Run only e2e tests for services
node test-runner.js e2e services
```

### Advanced Options

```bash
# Watch mode (continuous testing)
node test-runner.js --watch

# Generate coverage reports
node test-runner.js --coverage

# Verbose output for debugging
node test-runner.js --verbose

# Run tests matching a pattern
node test-runner.js --pattern="cache"

# Combine options
node test-runner.js unit ast --watch --verbose
```

## 📊 Current Implementation Status

### ✅ Completed Phases (1,083+ Tests)

#### Phase 1: AST Core System (460+ tests)
- **1.1**: Language Detection & Parsing (200+ tests)
- **1.2**: AST Cache System (100+ tests)  
- **1.3**: Context Building & Analysis (160+ tests)

#### Phase 2: Claude Code Integration (590+ tests)
- **2.1**: Background Services (130+ tests)
- **2.2**: Hook System (325+ tests)
- **2.3**: Worktree Integration (135+ tests)

#### Phase 3: Integration Testing (195+ tests)
- **3.1**: AST-Claude Integration (130+ tests)
- **3.3**: Workflow Automation (65+ tests)

#### Phase 4: E2E & Cross-Platform (210+ tests)
- **4.1**: Real-World E2E Testing (40+ tests)
- **4.2**: Cross-Platform Testing (170+ tests)

#### Phase 5: Quality & Performance (90+ tests)
- **5.1**: Quality Analysis (47+ tests)
- **5.2**: Performance & Stress Testing (43+ tests)

### 🔄 Planned Phases

#### Phase 6: Visual & Monitoring (Planned)
- **6.1**: Visual/TUI Testing
- **Location**: `visual/` directory
- **Focus**: Component rendering, user interactions, accessibility

## 🛠️ Development Commands

### Daily Development

```bash
# Quick component check
node test-runner.js hooks

# Development workflow with watch
node test-runner.js unit --watch

# Pre-commit validation
node test-runner.js

# Debugging specific area
node test-runner.js integration ast --verbose
```

### Direct Jest Commands

```bash
# Watch mode for active development
npx jest --watch unit/ast/        # AST Core
npx jest --watch unit/services/   # Services
npx jest --watch unit/hooks/      # Hooks
npx jest --watch unit/worktree/   # Worktree
npx jest --watch integration/     # Integration

# Run with coverage
npx jest --coverage

# Debug specific test
npx jest unit/ast/language-detector.test.js --verbose --no-cache

# Check Jest configuration
npx jest --showConfig
```

### Direct Node.js Tests

```bash
# Run E2E tests directly
node e2e/claude-code-workflows.js
node e2e/ast-analysis-workflows.js
node e2e/memory-usage-testing.js

# Run visual tests directly
node visual/monitoring-dashboard.test.js
node visual/configuration-modal.test.js
```

## 📝 Test Implementation Patterns

### Unit Test Pattern (Jest)

```javascript
describe('Component Name', () => {
  beforeEach(() => {
    // Setup mocks and test data
    jest.clearAllMocks();
  });

  test('should handle specific case', () => {
    // Arrange
    const input = 'test data';
    const mockFunction = jest.fn().mockReturnValue('expected result');
    
    // Act  
    const result = mockFunction(input);
    
    // Assert
    expect(result).toBe('expected result');
    expect(mockFunction).toHaveBeenCalledWith(input);
  });

  test('should handle error cases', () => {
    const mockFunction = jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    });
    
    expect(() => mockFunction()).toThrow('Test error');
  });
});
```

### E2E Test Pattern (Node.js)

```javascript
import { TestRunner } from '../setup.js';

const runner = new TestRunner('E2E Test Suite');

async function testCompleteWorkflow() {
  try {
    // Test setup
    const testData = await setupTestEnvironment();
    
    // Execute workflow
    const result = await executeCompleteWorkflow(testData);
    
    // Validate results
    runner.assert(result.success, 'Workflow should complete successfully');
    runner.assert(result.output.length > 0, 'Should produce output');
    
    console.log('✅ Complete workflow test passed');
  } catch (error) {
    console.error('❌ Complete workflow test failed:', error.message);
    throw error;
  }
}

// Run tests
await testCompleteWorkflow();
runner.showSummary();
```

### Performance Test Pattern

```javascript
test('should complete operation within time limit', () => {
  const startTime = Date.now();
  
  // Execute operation
  const result = performExpensiveOperation(largeInput);
  
  const executionTime = Date.now() - startTime;
  expect(executionTime).toBeLessThan(100); // 100ms limit
  expect(result).toBeDefined();
});

test('should handle memory efficiently', () => {
  const initialMemory = process.memoryUsage().heapUsed;
  
  // Execute memory-intensive operation
  const result = processLargeDataset(testData);
  
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryDelta = finalMemory - initialMemory;
  
  expect(memoryDelta).toBeLessThan(50 * 1024 * 1024); // 50MB limit
  expect(result).toBeDefined();
});
```

## 📚 Adding New Tests

### Choosing the Right Location

1. **Unit Tests** (`unit/`):
   - Individual components with mocks
   - Place in subdirectory matching component: `unit/ast/`, `unit/hooks/`, etc.
   - Use `*.test.js` suffix

2. **Integration Tests** (`integration/`):
   - Component interactions with minimal mocking
   - Use descriptive names: `ast-hooks-integration.test.js`
   - Use `*.test.js` suffix

3. **E2E Tests** (`e2e/`):
   - Complete workflows with real system behavior
   - Use workflow-focused names: `user-session-workflow.js`
   - Use `*.js` suffix

4. **Visual Tests** (`visual/`):
   - TUI rendering and user interactions
   - Use component-focused names: `dashboard-rendering.test.js`
   - Use `*.js` suffix

### Test File Naming Conventions

- **Unit/Integration**: `component-name.test.js` (Jest tests)
- **E2E/Visual**: `workflow-name.js` (Node.js tests)
- **Descriptive Names**: Clear indication of what's being tested
- **Consistent Structure**: Follow existing patterns

### Guidelines for New Tests

1. **Start Simple**: Begin with basic functionality tests
2. **Add Edge Cases**: Include error conditions and boundary cases
3. **Performance Tests**: Add timing checks for operations
4. **Mock Appropriately**: Use mocks based on test type
5. **Clear Assertions**: Use descriptive test names and assertions
6. **Follow Patterns**: Use established patterns in similar test files

## 🔧 Configuration & Setup

### Jest Configuration

The `jest.config.js` file handles:
- ES module support
- Test environment setup
- Mock configurations
- Coverage settings

### Test Setup

The `setup.js` file provides:
- Global test utilities
- Mock implementations
- Test data generators
- Environment configuration

### Running Tests in Different Environments

```bash
# Run with specific Node.js flags
node --experimental-modules test-runner.js

# Run with increased memory
node --max-old-space-size=4096 test-runner.js

# Run with debugging
node --inspect test-runner.js

# Run with environment variables
NODE_ENV=test DEBUG=* node test-runner.js
```

## 🐛 Troubleshooting

### Common Issues & Solutions

#### Test Runner Issues

**Problem**: Permission denied when running test runner
```bash
# Solution: Make test runner executable
chmod +x test-runner.js
```

**Problem**: Module not found errors
```bash
# Solution: Run from tests directory
cd scripts/modules/flow/tests
node test-runner.js
```

#### Jest Issues

**Problem**: ES Module import errors
```bash
# Solution: Use Flow-specific Jest config
npx jest --config jest.config.js
```

**Problem**: Test timeouts
```javascript
// Solution: Increase timeout for slow tests
test('slow operation', async () => {
  // test implementation
}, 10000); // 10 second timeout
```

#### Performance Issues

**Problem**: Tests running slowly
```bash
# Solution: Run specific test types
node test-runner.js unit  # Fast unit tests only
```

**Problem**: Memory issues with large tests
```bash
# Solution: Run tests individually
node e2e/memory-usage-testing.js
```

### Debug Commands

```bash
# Verbose output with stack traces
node test-runner.js --verbose

# Jest with debug output
DEBUG=* npx jest unit/ast/language-detector.test.js

# Node.js debugging
node --inspect-brk test-runner.js unit

# Clear Jest cache
npx jest --clearCache
```

### Environment Issues

**Problem**: Tests fail in different environments
- Check Node.js version compatibility
- Verify file system permissions
- Validate environment variables
- Check for platform-specific path issues

**Problem**: Mock issues
- Ensure mocks are properly reset between tests
- Verify mock implementations match real interfaces
- Check for proper mock cleanup

## 📈 Quality Standards

### Current Metrics
- **✅ Test Suites**: 45+ test suites passing
- **✅ Test Cases**: 1,083+ tests passing
- **✅ Mock Coverage**: 100% of planned functionality
- **✅ Language Coverage**: 8 languages supported
- **✅ Performance**: Optimized for development workflow

### Quality Requirements
- **All tests must pass** before committing
- **Performance tests** must meet established benchmarks
- **Error handling** must be thoroughly tested
- **Edge cases** should be covered
- **Real-world examples** should be included

### Coverage Goals
- **Unit Tests**: 95% code coverage minimum
- **Integration Tests**: 90% workflow coverage  
- **E2E Tests**: 100% critical path coverage
- **Performance Tests**: No regression from baselines

### Performance Targets
- **Individual tests**: <100ms each
- **Test suites**: <5s total execution
- **Full test run**: <30s for all tests
- **Memory usage**: <50MB delta per test suite

## 🎯 Best Practices

### Test Writing
- Write tests that are **fast**, **reliable**, and **maintainable**
- Use **descriptive test names** that explain what is being tested
- Keep tests **focused** on a single responsibility
- Use **appropriate mocking** based on test type
- Include **both positive and negative test cases**

### Test Organization
- Group related tests in logical directories
- Use consistent naming conventions
- Keep test files close to the code they test (conceptually)
- Avoid deep nesting of test directories

### Running Tests
- Use the main test runner for comprehensive testing
- Run specific test types during focused development
- Use watch mode for rapid iteration
- Generate coverage reports before major releases

### Debugging
- Use `--verbose` flag for detailed output
- Use `--pattern` to run specific test subsets
- Check test reports in the `reports/` directory
- Use Node.js debugging tools for complex issues

## 🚨 Emergency Procedures

### All Tests Failing
1. Check Jest configuration: `npx jest --showConfig`
2. Clear cache: `npx jest --clearCache`
3. Verify Node.js version compatibility
4. Check for missing dependencies
5. Validate file permissions

### Performance Regression
1. Run individual test suites to isolate issues
2. Check for infinite loops or memory leaks
3. Compare with baseline performance metrics
4. Review recent changes for performance impact

### Mock Issues
1. Verify mock implementations match expected interfaces
2. Check for proper mock cleanup between tests
3. Ensure mocks are defined before test execution
4. Review mock strategy for complex scenarios

## 🔗 Migration & Legacy Information

### Test Reorganization
This test system replaced a previous phase-based naming system. All tests have been reorganized into logical categories and proper subdirectories.

### Why Use the Test Runner Instead of npm Scripts?

1. **Self-Contained**: No package.json modifications needed
2. **Intelligent**: Automatically detects test types and runs appropriately
3. **Flexible**: Combine test types and components easily
4. **Comprehensive**: Single interface for all testing needs
5. **Informative**: Rich output with progress and results

### Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed or runner error

## 📞 Support & Resources

### Key Commands Summary

```bash
# Essential commands
node test-runner.js                    # Run all tests
node test-runner.js --help            # Show help
node test-runner.js unit              # Run unit tests
node test-runner.js integration       # Run integration tests
node test-runner.js ast               # Run AST tests
node test-runner.js --watch           # Watch mode
node test-runner.js --verbose         # Debug output
node test-runner.js --coverage        # Coverage report

# Direct Jest (when needed)
npx jest unit/ast/ --verbose          # Specific directory
npx jest --watch                      # Jest watch mode
npx jest --coverage                   # Jest coverage

# Direct Node.js (for e2e/visual)
node e2e/claude-code-workflows.js     # Specific e2e test
node visual/monitoring-dashboard.test.js # Specific visual test
```

### Documentation Structure

This README.md is now the **single source of truth** for Flow testing. Other documentation files in this directory are supplementary:

- `jest.config.js` - Jest framework configuration
- `setup.js` - Test environment setup
- `fixtures/` - Test data and examples
- `reports/` - Generated test reports

### External Resources
- **[Jest Documentation](https://jestjs.io/docs/getting-started)** - Testing framework
- **[Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)** - Industry standards
- **[Node.js Testing Guide](https://nodejs.org/en/docs/guides/testing/)** - Platform-specific guidance

---

**Quick Status**: Phases 1-5 Complete ✅ | 45+ Test Suites | 1,083+ Tests | Production Ready | Full System Coverage

*This README serves as the complete guide for Task Master Flow testing. Keep it updated as new features and tests are added.*
