# Task Master Flow - Comprehensive Test Suite

## 🎯 Unified Testing Strategy

This test suite provides comprehensive coverage of the entire Task Master Flow system using a unified approach that combines:

- **Jest Tests**: Unit & integration tests for components, utilities, and core logic
- **Non-Jest Tests**: End-to-end scenarios, performance tests, and interactive validation
- **Real-World Workflows**: Complete user journey testing with actual data

## 📁 Test Structure

```
scripts/modules/flow/tests/
├── README.md                          # This comprehensive guide
├── jest.config.js                     # Jest configuration for Flow tests
├── setup.js                          # Test environment setup & mocking
├── run-tests.js                      # Custom test runner for all test types
│
├── unit/                              # Jest Unit Tests
│   ├── ast/
│   │   ├── language-detector.test.js      # Language detection system
│   │   ├── parsers.test.js                # Base & language-specific parsers
│   │   ├── analyzers.test.js              # Code analysis & complexity scoring
│   │   ├── cache-system.test.js           # AST cache management
│   │   ├── file-watchers.test.js          # File watching & change detection
│   │   └── context-builders.test.js       # Context & dependency mapping
│   ├── backends/
│   │   ├── backend-interface.test.js      # Abstract backend interface
│   │   ├── direct-backend.test.js         # Direct function calls backend
│   │   ├── cli-backend.test.js            # CLI command execution backend
│   │   └── mcp-client-backend.test.js     # MCP server communication backend
│   ├── components/
│   │   ├── screens.test.js                # Screen components (Welcome, Task, etc.)
│   │   ├── modals.test.js                 # Modal components & interactions
│   │   ├── ui-elements.test.js            # Basic UI elements (buttons, inputs)
│   │   └── task-components.test.js        # Task-specific components
│   ├── hooks/
│   │   ├── theme-hooks.test.js            # Theme system hooks
│   │   ├── task-hooks.test.js             # Task management hooks
│   │   ├── modal-hooks.test.js            # Modal state management
│   │   └── utility-hooks.test.js          # Utility hooks (keypress, terminal)
│   ├── services/
│   │   ├── background-operations.test.js  # Background service management
│   │   ├── claude-code.test.js            # Claude Code integration
│   │   └── streaming.test.js              # Streaming state management
│   ├── mcp/
│   │   ├── client.test.js                 # MCP client functionality
│   │   ├── connection-pool.test.js        # Connection pooling
│   │   └── servers.test.js                # Server management
│   ├── personas/
│   │   ├── persona-detector.test.js       # AI persona detection
│   │   ├── persona-definitions.test.js    # Persona configurations
│   │   └── prompt-builder.test.js         # Persona prompt building
│   ├── session/
│   │   └── chat-session.test.js           # Chat session management
│   ├── theme/
│   │   ├── theme-manager.test.js          # Core theme system
│   │   ├── component-themes.test.js       # Component-specific theming
│   │   └── theme-utilities.test.js        # Theme utilities & helpers
│   └── worktree/
│       ├── worktree-manager.test.js       # Git worktree management
│       └── resource-monitor.test.js       # Resource monitoring
│
├── integration/                       # Jest Integration Tests
│   ├── ast-full-pipeline.test.js         # Complete AST analysis workflows
│   ├── backend-switching.test.js         # Backend switching & compatibility
│   ├── end-to-end-flows.test.js          # Complete user workflows
│   ├── theme-integration.test.js         # Theme system across components
│   ├── mcp-integration.test.js           # MCP server integration
│   ├── claude-code-integration.test.js   # Claude Code full workflows
│   └── worktree-integration.test.js      # Git worktree complete workflows
│
├── e2e/                               # Non-Jest End-to-End Tests
│   ├── user-workflows.js                 # Complete user journey simulations
│   ├── performance-benchmarks.js         # Performance & stress testing
│   ├── cross-platform.js                # Platform compatibility testing
│   ├── interactive-validation.js         # Interactive UI/UX validation
│   └── regression-tests.js               # Regression testing scenarios
│
├── visual/                            # Visual & Interactive Tests
│   ├── theme-showcase.js                 # Theme system visual validation
│   ├── component-showcase.js             # Component visual testing
│   ├── responsive-testing.js             # Terminal size responsiveness
│   └── accessibility-testing.js          # Accessibility validation
│
└── fixtures/                          # Test Data & Fixtures
    ├── sample-projects/                   # Sample project structures
    ├── mock-responses/                    # Mock API/MCP responses
    ├── test-code-files/                   # Sample code for AST testing
    └── theme-configurations/              # Test theme configurations
```

## 🧪 Test Categories

### 1. Jest Unit Tests (`unit/`)
**Purpose**: Test individual components and functions in isolation
**Coverage**: 
- AST language detection, parsing, analysis
- Backend interface implementations
- UI components rendering and interactions
- Hooks behavior and state management
- Theme system functionality
- Service integrations

**Key Features**:
- Mocked dependencies for isolation
- Comprehensive edge case coverage
- Performance assertions
- Error handling validation

### 2. Jest Integration Tests (`integration/`)
**Purpose**: Test component interactions and complete workflows
**Coverage**:
- AST full pipeline (detection → parsing → analysis → caching)
- Backend switching and data consistency
- Theme application across component hierarchy
- MCP server communication workflows
- Claude Code integration scenarios

**Key Features**:
- Real component interactions
- Workflow validation
- Cross-component data flow
- State management validation

### 3. Non-Jest End-to-End Tests (`e2e/`)
**Purpose**: Test complete user journeys and system behavior
**Coverage**:
- Complete user workflows from start to finish
- Performance under real-world conditions
- Cross-platform compatibility
- Memory usage and resource management

**Key Features**:
- No mocking - real system interactions
- Performance benchmarking
- User experience validation
- System resource monitoring

### 4. Visual Tests (`visual/`)
**Purpose**: Validate UI/UX and visual consistency
**Coverage**:
- Theme rendering across different terminals
- Component visual consistency
- Responsive design validation
- Accessibility compliance

## 🚀 Test Execution

### Run All Tests
```bash
# Run complete test suite (Jest + Non-Jest)
npm run test:flow

# Or use the custom runner
node scripts/modules/flow/tests/run-tests.js --all
```

### Run Specific Test Categories
```bash
# Jest tests only
npm run test:flow:jest

# Unit tests only
npm run test:flow:unit

# Integration tests only  
npm run test:flow:integration

# End-to-end tests only
npm run test:flow:e2e

# Visual tests only
npm run test:flow:visual
```

### Development Testing
```bash
# Watch mode for development
npm run test:flow:watch

# Run tests for specific component
npm run test:flow:component TaskManagementScreen

# Run tests with coverage
npm run test:flow:coverage
```

## 📊 Test Metrics & Coverage

### Coverage Targets
- **Unit Tests**: 95% code coverage minimum
- **Integration Tests**: 90% workflow coverage
- **E2E Tests**: 100% critical path coverage
- **Visual Tests**: 100% component coverage

### Performance Benchmarks
- **AST Parsing**: < 100ms for typical files
- **UI Rendering**: < 50ms component mount
- **Backend Switching**: < 200ms transition
- **Theme Changes**: < 30ms application

### Quality Gates
- All tests must pass before merge
- Performance regressions not allowed
- Coverage thresholds enforced
- Visual consistency maintained

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)
- Custom transformers for JSX/React components
- Mock configurations for terminal/Ink components
- Coverage reporting and thresholds
- Test environment setup

### Test Environment (`setup.js`)
- Mock terminal components
- Global test utilities
- Environment variable setup
- Shared test fixtures

### Custom Test Runner (`run-tests.js`)
- Orchestrates Jest and Non-Jest tests
- Provides unified reporting
- Handles test categorization
- Manages test environments

## 🎨 Test Data Management

### Fixtures Structure
```
fixtures/
├── sample-projects/
│   ├── javascript-project/       # JS/TS project for AST testing
│   ├── python-project/           # Python project for AST testing
│   ├── go-project/               # Go project for AST testing
│   └── mixed-language/           # Multi-language project
├── mock-responses/
│   ├── mcp-responses.json        # Mock MCP server responses
│   ├── claude-responses.json     # Mock Claude Code responses
│   └── api-responses.json        # Mock API responses
├── test-code-files/
│   ├── complex-javascript.js     # Complex JS for parser testing
│   ├── malformed-code.py         # Error handling test cases
│   └── large-file.go             # Performance testing files
└── theme-configurations/
    ├── custom-themes.json        # Custom theme configurations
    └── edge-case-themes.json     # Edge case theme testing
```

## 🔍 Testing Best Practices

### Unit Test Guidelines
- Test one thing at a time
- Use descriptive test names
- Mock external dependencies
- Cover edge cases and errors
- Assert on behavior, not implementation

### Integration Test Guidelines
- Test realistic workflows
- Use minimal mocking
- Validate data flow between components
- Test error propagation
- Verify state consistency

### E2E Test Guidelines
- Test from user perspective
- Use real data and scenarios
- Validate complete workflows
- Monitor performance metrics
- Test error recovery

### Visual Test Guidelines
- Test across terminal types
- Validate responsive behavior
- Check accessibility features
- Verify theme consistency
- Test keyboard navigation

## 🚨 Continuous Integration

### Pre-commit Hooks
- Run unit tests for changed files
- Lint test files
- Validate test coverage
- Check performance impacts

### CI Pipeline
1. **Fast Tests**: Unit tests (< 2 minutes)
2. **Integration Tests**: Component interactions (< 5 minutes)
3. **E2E Tests**: Complete workflows (< 10 minutes)
4. **Visual Tests**: UI/UX validation (< 3 minutes)
5. **Performance Tests**: Benchmarking (< 5 minutes)

### Quality Gates
- All test categories must pass
- Coverage thresholds enforced
- Performance regressions blocked
- Visual consistency verified

## 🔄 Test Maintenance

### Regular Updates
- Update fixtures with new features
- Refresh performance benchmarks
- Validate cross-platform compatibility
- Update visual baselines

### Test Review Process
- Review test coverage in PRs
- Validate test quality and maintenance
- Ensure test documentation updates
- Monitor test execution times

---

## 📋 Implementation Checklist

### Phase 1: Core Infrastructure ✅
- [x] Test directory structure
- [x] Jest configuration
- [x] Test runner setup
- [x] Basic fixtures

### Phase 2: Unit Tests 🔄
- [ ] AST system unit tests
- [ ] Backend unit tests  
- [ ] Component unit tests
- [ ] Hook unit tests
- [ ] Service unit tests

### Phase 3: Integration Tests 🔄
- [ ] AST pipeline integration
- [ ] Backend integration
- [ ] Theme integration
- [ ] MCP integration

### Phase 4: E2E Tests 🔄
- [ ] User workflow tests
- [ ] Performance benchmarks
- [ ] Cross-platform tests
- [ ] Interactive validation

### Phase 5: Visual Tests 🔄
- [ ] Theme showcase
- [ ] Component showcase  
- [ ] Responsive testing
- [ ] Accessibility testing

### Phase 6: CI/CD Integration 🔄
- [ ] Pre-commit hooks
- [ ] CI pipeline setup
- [ ] Quality gates
- [ ] Performance monitoring

---

*This comprehensive test suite ensures the reliability, performance, and user experience of the Task Master Flow system across all its components and workflows.*
