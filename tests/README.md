# Flow & AST Test Suite

> Comprehensive testing for Task Master Flow system including AST intelligence and Flow UI/backend functionality.

## 🎯 Overview

This directory contains a complete test suite for the Task Master Flow system, providing comprehensive coverage of:
- **AST Intelligence**: Multi-language parsing, analysis, and intelligence features
- **Flow UI**: Terminal-based user interface components and interactions  
- **Flow Backend**: CLI, Direct, and MCP backend interfaces
- **Integration**: End-to-end workflows and system integration

## 🏗️ Test Structure

```
scripts/modules/flow/tests/
├── README.md                           # This documentation
├── jest.config.js                      # Jest configuration for Flow tests
├── setup.js                           # Test environment setup & mocking
├── run-tests.js                       # Custom test runner script
├── ast/
│   └── integration.test.js            # AST system integration tests
├── flow/
│   ├── backend.test.js                # Flow backend systems tests
│   └── components.test.js             # Flow UI component tests
└── integration/
    └── e2e.test.js                    # End-to-end integration tests
```

## 🚀 Running Tests

### Quick Start

```bash
# Navigate to Flow tests
cd scripts/modules/flow/tests

# Run all tests
./run-tests.js

# Run specific test suites
./run-tests.js ast           # AST-specific tests only
./run-tests.js flow          # Flow UI/backend tests only  
./run-tests.js integration   # Integration tests only
./run-tests.js coverage      # All tests with coverage report
```

### Using Jest Directly

```bash
# Run all Flow tests
npx jest --config jest.config.js

# Run specific test files
npx jest ast/integration.test.js
npx jest flow/backend.test.js

# Watch mode for development
npx jest --config jest.config.js --watch

# Generate coverage report
npx jest --config jest.config.js --coverage
```

## 📊 Test Coverage

### 1. AST Intelligence System ✅
- ✅ Language Detection (JavaScript, TypeScript, Python, Go)
- ✅ Multi-language parsing with error recovery
- ✅ Parser registry management and validation
- ✅ Performance testing with large files

### 2. Flow System ✅
- ✅ Backend interface abstraction
- ✅ CLI, Direct, and MCP Backend integration
- ✅ UI component testing with proper mocking
- ✅ Session management and streaming

### 3. Integration Testing ✅
- ✅ AST + Flow system integration
- ✅ Multi-backend support validation
- ✅ Real-world project workflow simulation
- ✅ Performance and error recovery testing

## 🔄 Integration with Project Tests

This Flow test suite complements the existing project test structure:

```
task-master/
├── tests/                              # General Task Master tests
│   ├── e2e/                           # CLI end-to-end tests
│   ├── integration/                   # System integration tests
│   ├── unit/                          # Core module unit tests
│   └── README.md                      # General testing documentation
└── scripts/modules/flow/tests/        # Flow & AST test suite
    ├── ast/                           # AST intelligence tests
    ├── flow/                          # Flow UI/backend tests
    └── integration/                   # Flow integration tests
```

## 🛠️ Technical Features

### Test Infrastructure
- **Jest Framework**: Optimized for ES modules and Flow system
- **Mock System**: Proper mocking for terminal UI (blessed) components
- **Test Environment**: Isolated environment with automatic cleanup
- **Custom Runner**: Flexible execution for different test categories
- **Coverage Reports**: Comprehensive tracking with configurable thresholds

### Test Quality Standards
- **Error Scenarios**: Comprehensive edge case and error condition testing
- **Performance Benchmarks**: Critical operation timing and memory validation
- **Integration Validation**: Cross-component interaction verification
- **Mock Strategies**: Meaningful mocks that preserve test value

## 📝 Development Guidelines

### Adding New Tests
1. Identify the appropriate test category (ast/, flow/, integration/)
2. Create test file following naming conventions (`*.test.js`)
3. Follow existing test patterns and mock strategies
4. Ensure proper cleanup and isolation
5. Update this README if adding new test categories

### Test Standards
- Follow existing test patterns and structure
- Include both positive and negative test cases
- Add performance benchmarks for new functionality
- Ensure proper error handling test coverage
- Update documentation when adding new test areas

---

**Status: ✅ PRODUCTION READY**

This test suite provides comprehensive validation of the Flow & AST systems and is ready for production use.
