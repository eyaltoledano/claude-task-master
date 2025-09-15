# Testing Guide for LM Studio Integration and Auto-Complexity Expansion

This document provides comprehensive testing information for the new LM Studio AI provider integration and the `--auto` functionality for `parse-prd` command.

## Overview

The testing suite covers two major new features:

1. **LM Studio AI Provider Integration** - Local AI model support without API keys
2. **Auto-Complexity Expansion** - Automated task complexity analysis and expansion workflow

## Test Structure

### Unit Tests

#### LM Studio Provider Tests
- **File**: `tests/unit/ai-providers/lmstudio.test.js`
- **Coverage**: 
  - Authentication validation (no API key required)
  - Client creation with base URL configuration
  - Token parameter handling
  - Model support and validation
  - Error handling and edge cases
  - Provider integration compatibility

#### Auto-Complexity Expansion Tests
- **File**: `tests/unit/task-manager/auto-complexity-expansion.test.js`
- **Coverage**:
  - `runAutoComplexityExpansion` function behavior
  - Integration with `analyzeTaskComplexity`
  - Integration with `expandAllTasks`
  - Error handling and edge cases
  - Telemetry data handling
  - Threshold configuration

### Integration Tests

#### Parse-PRD Auto Workflow Tests
- **File**: `tests/integration/parse-prd-auto-workflow.test.js`
- **Coverage**:
  - End-to-end parse-prd with --auto flag
  - Integration between PRD parsing, complexity analysis, and task expansion
  - CLI argument parsing and validation
  - File system operations and cleanup
  - Error handling in the complete workflow
  - Telemetry data flow through the entire process

#### MCP Server Integration Tests
- **File**: `tests/integration/mcp-server/parse-prd-auto-mcp.test.js`
- **Coverage**:
  - MCP tool schema validation for --auto arguments
  - MCP server integration with auto-complexity-expansion
  - Error handling in MCP context
  - Response structure validation
  - Telemetry data handling in MCP responses

## Running Tests

### Individual Test Suites

```bash
# Run LM Studio provider tests
npm run test:lmstudio

# Run auto-complexity expansion tests
npm run test:auto-complexity

# Run parse-prd auto workflow tests
npm run test:parse-prd-auto

# Run MCP auto integration tests
npm run test:mcp-auto
```

### Test Categories

```bash
# Run all unit tests
npm run test:unit

# Run all integration tests
npm run test:integration

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Test Configuration

### Jest Configuration
The tests use the existing Jest configuration in `jest.config.js` with:
- Node.js test environment
- ES modules support
- Coverage thresholds: 80% for branches, functions, lines, and statements
- Comprehensive mocking for AI services and external dependencies

### Mock Strategy
Tests use comprehensive mocking to:
- Prevent actual AI API calls during testing
- Isolate units under test
- Provide predictable test data
- Simulate various error conditions

## Key Test Scenarios

### LM Studio Provider

1. **Authentication**
   - No API key required for local usage
   - Optional API key for remote usage
   - Graceful handling of missing keys

2. **Client Creation**
   - Default base URL configuration
   - Custom base URL support
   - Different port configurations
   - Model ID handling

3. **Token Parameters**
   - Token value validation and coercion
   - Edge cases (null, undefined, large values)
   - String to integer conversion

4. **Error Handling**
   - Invalid base URLs
   - Empty model IDs
   - Network failures

### Auto-Complexity Expansion

1. **Successful Execution**
   - Complexity analysis integration
   - Task expansion based on threshold
   - Telemetry data collection
   - Summary reporting

2. **Error Handling**
   - Complexity analysis failures
   - Missing complexity reports
   - Expansion failures
   - Graceful degradation

3. **Configuration**
   - Threshold parameter handling
   - Research flag support
   - Tag context support
   - Default value handling

4. **Edge Cases**
   - Empty task files
   - Missing telemetry data
   - Different tag contexts
   - Path resolution

### Parse-PRD Auto Workflow

1. **CLI Integration**
   - Argument parsing validation
   - Default parameter handling
   - Force flag behavior

2. **End-to-End Workflow**
   - PRD parsing success
   - Automatic complexity analysis
   - Intelligent task expansion
   - File system operations

3. **Error Recovery**
   - PRD parsing failure handling
   - Auto-expansion failure recovery
   - File system error handling

4. **Telemetry Flow**
   - Data collection from all phases
   - Proper data structure validation
   - Cost and token tracking

### MCP Server Integration

1. **Schema Validation**
   - Parameter type validation
   - Default value handling
   - Required vs optional parameters

2. **Execution**
   - Successful MCP tool execution
   - Error handling in MCP context
   - Response structure validation

3. **Data Flow**
   - Telemetry data in MCP responses
   - Proper error propagation
   - Session context handling

## Test Data

### Sample PRD Content
Tests use realistic PRD content covering:
- Project overview and features
- Technical requirements
- Success criteria
- Multiple complexity levels

### Mock Task Data
Tests include:
- Simple, medium, and complex tasks
- Various priority levels
- Dependency relationships
- Realistic implementation details

### Mock Complexity Results
Tests simulate:
- Different complexity scores
- Expansion recommendations
- Telemetry data structures
- Error conditions

## Coverage Goals

### Unit Tests
- **LM Studio Provider**: 95%+ coverage
- **Auto-Complexity Expansion**: 90%+ coverage

### Integration Tests
- **Parse-PRD Auto Workflow**: 85%+ coverage
- **MCP Server Integration**: 85%+ coverage

### Overall Project
- Maintain 80%+ overall coverage
- Critical paths: 90%+ coverage
- Error handling: 85%+ coverage

## Debugging Tests

### Common Issues

1. **Mock Configuration**
   - Ensure all dependencies are properly mocked
   - Check mock implementation matches expected behavior
   - Verify mock cleanup between tests

2. **File System Operations**
   - Use temporary directories for test files
   - Clean up test files after tests
   - Handle file system permissions

3. **Async Operations**
   - Properly await async operations
   - Handle promise rejections
   - Use appropriate timeouts

### Debug Commands

```bash
# Run specific test with verbose output
npm test -- --verbose tests/unit/ai-providers/lmstudio.test.js

# Run tests with coverage for specific file
npm run test:coverage -- tests/unit/task-manager/auto-complexity-expansion.test.js

# Debug failing tests
npm run test:fails
```

## Continuous Integration

### Pre-commit Hooks
Tests should run before commits to ensure:
- All new functionality is tested
- No regressions are introduced
- Code quality standards are maintained

### CI Pipeline
The CI pipeline should:
- Run all test suites
- Generate coverage reports
- Fail on coverage threshold violations
- Provide detailed test results

## Future Enhancements

### Additional Test Coverage
- Performance testing for large task sets
- Stress testing for concurrent operations
- Memory usage testing for long-running processes

### Test Automation
- Automated test data generation
- Dynamic test case creation
- Integration with external test services

## Contributing

When adding new tests:

1. Follow existing test patterns and conventions
2. Use descriptive test names and organization
3. Include comprehensive error scenarios
4. Maintain high coverage standards
5. Update this documentation as needed

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Task Master Testing Guidelines](tests/README.md)
