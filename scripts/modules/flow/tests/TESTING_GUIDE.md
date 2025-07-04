# Task Master Flow - Testing Quick Reference Guide

## 🚀 Quick Commands

### Enhanced Test Runner (Recommended)
```bash
cd scripts/modules/flow/tests

# Run all phases with advanced analytics and parallel execution
node run-enhanced-tests.js

# Run specific phases with enhanced features
node run-enhanced-tests.js --phases 1.1,2.1,4.2

# Fast execution (skip fixture generation)
node run-enhanced-tests.js --no-fixtures

# Create performance baseline for regression detection
node run-enhanced-tests.js --save-baseline

# See all options
node run-enhanced-tests.js --help
```

### Individual Phase Tests

### Run All Phase 1.1 Tests
```bash
cd scripts/modules/flow/tests
node run-phase-1-1-tests.js
```

### Run All Phase 2.1 Tests
```bash
cd scripts/modules/flow/tests
node run-phase-2-1-tests.js
```

### Run All Phase 2.2 Tests
```bash
cd scripts/modules/flow/tests
node run-phase-2-2-tests.js
```

### Run All Phase 2.3 Tests
```bash
cd scripts/modules/flow/tests
node run-phase-2-3-tests.js
```

### Run All Phase 3.1 Tests
```bash
cd scripts/modules/flow/tests
node run/run-phase-3-1-tests.js
```

### Run All Phase 3.3 Tests
```bash
cd scripts/modules/flow/tests
node run/run-phase-3-3-tests.js
```

### Run All Phase 4.1 Tests
```bash
cd scripts/modules/flow/tests
node run/run-phase-4-1-tests.js
```

### Run All Phase 4.2 Tests
```bash
cd scripts/modules/flow/tests
node run/run-phase-4-2-tests.js
```

### Run All Phase 5.1 Tests
```bash
cd scripts/modules/flow/tests
node run/run-phase-5-1-tests.js
```

### Run All Phase 5.2 Tests
```bash
cd scripts/modules/flow/tests
node run/run-phase-5-2-tests.js
```

### Run All Phase 6.1 Tests
```bash
cd scripts/modules/flow/tests
node run/run-phase-6-1-tests.js
```

### Run Specific Test Categories
```bash
# AST Core System (Phase 1.1) - 500+ tests
npx jest unit/ast/ --verbose

# Language Detection (46 tests)
npx jest unit/ast/language-detector.test.js --verbose

# All Parser Tests (90+ tests)
npx jest unit/ast/parsers/ --verbose

# AST Generation & Validation (35+ tests)  
npx jest unit/ast/ast-generation.test.js --verbose

# Background Services (Phase 2.1) - 130+ tests
npx jest unit/services/ --verbose

# Hook System (Phase 2.2) - 325+ tests
npx jest unit/hooks/ --verbose

# Worktree Integration (Phase 2.3) - 135+ tests
npx jest unit/worktree/ --verbose

# AST-Claude Integration (Phase 3.1) - 130+ tests
npx jest integration/ --verbose

# Quality Analysis (Phase 5.1) - 47+ tests
npx jest unit/hooks/quality/ --verbose

# Cross-Platform Testing (Phase 4.2) - 170+ tests
node tests/cross-platform-compatibility.js
node tests/git-integration-testing.js
node tests/filesystem-testing.js
node tests/resource-management-testing.js

# Performance & Stress Testing (Phase 5.2) - 43+ tests
node e2e/memory-usage-testing.js
node e2e/concurrent-session-testing.js
node e2e/large-project-testing.js
node e2e/cache-performance-testing.js

# Visual & Monitoring (Phase 6.1) - Future
cd scripts/modules/flow/tests && npx jest visual/monitoring-dashboard.test.js --verbose
cd scripts/modules/flow/tests && npx jest visual/configuration-modal.test.js --verbose
cd scripts/modules/flow/tests && npx jest visual/notification-display.test.js --verbose
cd scripts/modules/flow/tests && npx jest visual/theme-integration.test.js --verbose
```

### Development Commands
```bash
# Watch mode for active development
npx jest --watch unit/ast/        # Phase 1.1 AST Core
npx jest --watch unit/services/   # Phase 2.1 Services
npx jest --watch unit/hooks/      # Phase 2.2 Hooks
npx jest --watch unit/worktree/   # Phase 2.3 Worktree
npx jest --watch integration/     # Phase 3.1 Integration

# Run with coverage
npx jest --coverage

# Debug specific test
npx jest unit/ast/language-detector.test.js --verbose --no-cache

# Debug specific phase
DEBUG=* node run-phase-2-1-tests.js
DEBUG=* node run-phase-2-2-tests.js

# Check Jest configuration
npx jest --showConfig
```

---

## 📁 Test File Organization

### Phase 1.1 - AST System (COMPLETE)
```
unit/ast/
├── language-detector.test.js     # 46 tests - File & content detection
├── ast-generation.test.js        # 35+ tests - AST structure validation
├── analyzers.test.js             # 20+ tests - Code complexity analysis
├── parser-registry.test.js       # 25+ tests - Parser management
└── parsers/
    ├── javascript-parser.test.js # 30+ tests - JS/TS parsing
    ├── python-parser.test.js     # 30+ tests - Python parsing  
    └── go-parser.test.js         # 30+ tests - Go parsing
```

### Phase 2.1 - Background Services (COMPLETE)
```
unit/services/
├── background-claude-code.test.js    # 30+ tests - Core service lifecycle
├── streaming-state-manager.test.js   # 25+ tests - State management
├── pr-monitoring-service.test.js     # 25+ tests - PR lifecycle monitoring
├── workflow-state-manager.test.js    # 25+ tests - Workflow coordination
└── service-mesh.test.js              # 25+ tests - Service communication
```

### Phase 2.2 - Hook System (COMPLETE)
```
unit/hooks/
├── hook-executor.test.js             # 45+ tests - Hook execution engine
├── hook-validator.test.js            # 35+ tests - Hook validation
├── hook-context.test.js              # 40+ tests - Context management
├── hook-storage.test.js              # 30+ tests - Storage & persistence
├── hook-coordinator.test.js          # 35+ tests - Hook coordination
├── hook-scheduler.test.js            # 30+ tests - Scheduling & timing
├── hook-registry.test.js             # 25+ tests - Hook registration
├── hook-lifecycle.test.js            # 30+ tests - Lifecycle management
├── hook-event-system.test.js         # 25+ tests - Event handling
└── built-in/
    ├── claude-code-stop.test.js      # 30+ tests - Session termination
    ├── pre-launch-validation.test.js # 25+ tests - Pre-execution validation
    ├── session-completion.test.js    # 25+ tests - Session cleanup
    ├── pr-lifecycle-management.test.js # 30+ tests - PR management
    └── research-integration.test.js  # 20+ tests - Research workflow
```

### Phase 2.3 - Worktree Integration (COMPLETE)
```
unit/worktree/
├── worktree-manager.test.js          # 45+ tests - Git worktree management
├── simple-worktree-manager.test.js   # 25+ tests - Simplified operations
├── resource-monitor.test.js          # 35+ tests - Resource monitoring
└── worktree-coordinator.test.js      # 30+ tests - Multi-worktree coordination
```

### Phase 3.1 - AST-Claude Integration (COMPLETE)
```
integration/
├── ast-claude-integration.test.js           # 40+ tests - Core integration
├── worktree-ast-integration.test.js         # 30+ tests - Worktree coordination
├── cache-invalidation-integration.test.js   # 35+ tests - Cache management
└── context-building-integration.test.js     # 25+ tests - Context pipeline
```

### Phase 3.3 - Workflow Automation Integration (COMPLETE)
```
integration/
├── complete-workflow-integration.test.js    # 20+ tests - End-to-end workflows
├── multi-session-integration.test.js        # 18+ tests - Multi-session handling
├── error-recovery-integration.test.js       # 15+ tests - Error handling
└── performance-integration.test.js          # 12+ tests - Performance benchmarks
```

### Phase 4.1 - Real-World E2E Testing (COMPLETE)
```
e2e/real-world/
├── claude-code-workflows.test.js     # 10+ tests - Complete task workflows
├── ast-analysis-workflows.test.js    # 10+ tests - Multi-language analysis
├── hook-automation-workflows.test.js # 10+ tests - Automation pipelines
└── performance-benchmarks.test.js    # 10+ tests - Real-world performance
```

### Phase 4.2 - Cross-Platform Testing (COMPLETE)
```
tests/
├── cross-platform-compatibility.js   # 170+ tests - Platform differences
├── git-integration-testing.js        # Git operations across platforms
├── filesystem-testing.js             # Filesystem compatibility
└── resource-management-testing.js    # Resource handling variations
```

### Phase 5.1 - Quality Analysis Testing (COMPLETE)
```
unit/hooks/quality/
├── code-quality-analyzer.test.js     # 20+ tests - Quality metrics
├── quality-insights-formatter.test.js # 15+ tests - PR formatting
└── test-quality-analyzer.test.js     # 12+ tests - Linting integration
```

### Phase 5.2 - Performance & Stress Testing (COMPLETE)
```
e2e/
├── memory-usage-testing.js           # 11 tests - Memory optimization
├── concurrent-session-testing.js     # 11 tests - Multi-session handling
├── large-project-testing.js          # 10 tests - Large-scale processing
└── cache-performance-testing.js      # 11 tests - Cache efficiency
```

### Phase 6.1 - Visual & Monitoring Testing (COMPLETE)
```
visual/
├── monitoring-dashboard.test.js       # 15+ tests - Real-time display & metrics
├── configuration-modal.test.js        # 20+ tests - Settings & form validation
├── notification-display.test.js       # 18+ tests - Notification system
└── theme-integration.test.js          # 25+ tests - Theme consistency & accessibility
```



---

## 🧪 Test Patterns

### Phase 6.1 Visual Testing Patterns
```javascript
describe('Visual Component Testing', () => {
  beforeEach(() => {
    // Mock UI components and interactions
    mockComponent.render.mockImplementation((props) => {
      return { success: true, rendered: true, props };
    });
  });

  test('should render with correct visual properties', () => {
    const result = mockComponent.render({ theme: 'dark', size: 'large' });
    
    expect(result.success).toBe(true);
    expect(result.props.theme).toBe('dark');
    expect(result.props.size).toBe('large');
  });

  test('should meet accessibility standards', () => {
    const accessibility = mockComponent.checkAccessibility();
    
    expect(accessibility.contrastRatio).toBeGreaterThan(4.5);
    expect(accessibility.wcagLevel).toBe('AAA');
  });

  test('should perform within time limits', () => {
    const startTime = Date.now();
    mockComponent.render({ complex: true });
    const executionTime = Date.now() - startTime;
    
    expect(executionTime).toBeLessThan(100); // 100ms limit
  });
});
```

### Basic Test Structure
```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup mocks and test data
  });

  test('should handle specific case', () => {
    // Arrange
    const input = 'test data';
    
    // Act  
    const result = mockFunction(input);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.someProperty).toBe('expected value');
  });

  test('should handle error cases', () => {
    expect(() => mockFunction(null)).toThrow();
  });
});
```

### Performance Test Pattern
```javascript
test('should complete operation within time limit', () => {
  const startTime = Date.now();
  
  // Execute operation
  const result = mockFunction(largeInput);
  
  const executionTime = Date.now() - startTime;
  expect(executionTime).toBeLessThan(100); // 100ms limit
  expect(result).toBeDefined();
});
```

### Mock Implementation Pattern
```javascript
const mockFunction = jest.fn().mockImplementation((input) => {
  // Realistic behavior simulation
  if (!input) return null;
  
  return {
    processedData: input.toUpperCase(),
    confidence: 0.8,
    metadata: { processed: true }
  };
});
```

---

## 🔧 Adding New Tests

### For Existing Phase 1.1 Features
1. **Choose the right test file**:
   - Language detection → `language-detector.test.js`
   - Parser functionality → `parsers/[language]-parser.test.js`
   - Code analysis → `analyzers.test.js`
   - AST structure → `ast-generation.test.js`
   - Parser management → `parser-registry.test.js`

### For Phase 2.1 Background Services
1. **Choose the right test file**:
   - Core service → `services/background-claude-code.test.js`
   - State management → `services/streaming-state-manager.test.js`
   - PR monitoring → `services/pr-monitoring-service.test.js`
   - Workflow coordination → `services/workflow-state-manager.test.js`
   - Service communication → `services/service-mesh.test.js`

### For Phase 2.2 Hook System
1. **Choose the right test file**:
   - Hook execution → `hooks/hook-executor.test.js`
   - Hook validation → `hooks/hook-validator.test.js`
   - Context management → `hooks/hook-context.test.js`
   - Storage operations → `hooks/hook-storage.test.js`
   - Built-in hooks → `hooks/built-in/[hook-name].test.js`

### For Phase 2.3 Worktree Integration
1. **Choose the right test file**:
   - Worktree management → `worktree/worktree-manager.test.js`
   - Simple operations → `worktree/simple-worktree-manager.test.js`
   - Resource monitoring → `worktree/resource-monitor.test.js`
   - Multi-worktree coordination → `worktree/worktree-coordinator.test.js`

### For Phase 3.1 AST-Claude Integration
1. **Choose the right test file**:
   - Core integration → `integration/ast-claude-integration.test.js`
   - Worktree coordination → `integration/worktree-ast-integration.test.js`
   - Cache management → `integration/cache-invalidation-integration.test.js`
   - Context pipeline → `integration/context-building-integration.test.js`

### For Phase 4.2 Cross-Platform Testing
1. **Choose the right test file**:
   - Platform compatibility → `tests/cross-platform-compatibility.js`
   - Git operations → `tests/git-integration-testing.js`
   - Filesystem operations → `tests/filesystem-testing.js`
   - Resource management → `tests/resource-management-testing.js`

### For Phase 5.1 Quality Analysis
1. **Choose the right test file**:
   - Quality metrics → `unit/hooks/quality/code-quality-analyzer.test.js`
   - PR formatting → `unit/hooks/quality/quality-insights-formatter.test.js`
   - Linting integration → `unit/hooks/quality/test-quality-analyzer.test.js`

### For Phase 5.2 Performance Testing
1. **Choose the right test file**:
   - Memory testing → `e2e/memory-usage-testing.js`
   - Concurrent sessions → `e2e/concurrent-session-testing.js`
   - Large projects → `e2e/large-project-testing.js`
   - Cache performance → `e2e/cache-performance-testing.js`

### For Phase 6.1 Visual Features
1. **Choose the right test file**:
   - Real-time monitoring → `visual/monitoring-dashboard.test.js`
   - Settings and configuration → `visual/configuration-modal.test.js`
   - Notifications and alerts → `visual/notification-display.test.js`
   - Themes and accessibility → `visual/theme-integration.test.js`

2. **Follow established patterns**:
   - Use descriptive test names
   - Include both success and error cases
   - Add performance tests for new operations
   - Update mocks to support new scenarios

3. **Test your changes**:
   ```bash
   npx jest [test-file] --verbose
   node run-phase-1-1-tests.js
   ```

2. **Follow established visual patterns**:
   - Include accessibility tests for all UI components
   - Add performance benchmarks for rendering operations
   - Test theme consistency across all visual states
   - Verify user interaction handling and feedback

3. **Test your visual changes**:
   ```bash
   cd scripts/modules/flow/tests
   npx jest visual/[test-file] --verbose
   node run/run-phase-6-1-tests.js
   ```

### For New Test Phases
1. **Review the testing plan**: Check `testing_plan.md` for requirements
2. **Create directory structure**: Follow Phase 1.1 patterns
3. **Implement core tests**: Start with most critical functionality
4. **Create phase runner**: Like `run-phase-1-1-tests.js`
5. **Update documentation**: Add to main docs

---

## 🐛 Debugging Tests

### Common Issues & Solutions

#### Jest Configuration Problems
```bash
# Check current configuration
npx jest --showConfig

# Clear Jest cache
npx jest --clearCache

# Run with no cache
npx jest --no-cache
```

#### ES Module Import Issues
- **Problem**: `SyntaxError: Cannot use import statement outside a module`
- **Solution**: Use CommonJS `require()` or check `jest.config.cjs`

#### Mock Not Working
```javascript
// Ensure mocks are properly defined before tests
const mockFunction = jest.fn().mockImplementation(/* ... */);

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

#### Test Timeout Issues
```javascript
// Increase timeout for slow tests
test('slow operation', async () => {
  // test implementation
}, 10000); // 10 second timeout
```

### Debug Commands
```bash
# Run with debug output
DEBUG=* npx jest unit/ast/language-detector.test.js

# Node.js debugging
node --inspect-brk node_modules/.bin/jest unit/ast/language-detector.test.js

# Verbose output with stack traces
npx jest --verbose --detectOpenHandles
```

---

## 📊 Understanding Test Results

### Phase 1.1 Test Runner Output
```
✅ Language Detector Tests: 46/46 passing
✅ JavaScript Parser Tests: 30/30 passing  
✅ Python Parser Tests: 30/30 passing
✅ Go Parser Tests: 30/30 passing
✅ Parser Registry Tests: 25/25 passing
✅ AST Generation Tests: 35/35 passing
✅ AST Analyzers Tests: 20/20 passing

Phase 1.1 Summary: 7/7 suites passing (216 total tests)
```

### Jest Output Interpretation
- **PASS**: Test suite completed successfully
- **FAIL**: One or more tests failed
- **Snapshots**: Serialized test outputs (not used in current tests)
- **Coverage**: Code coverage percentage (when enabled)

### Performance Metrics
- **Execution time**: Should be <5 seconds for full Phase 1.1 suite
- **Memory usage**: Monitor for memory leaks in long-running tests
- **Cache hits**: Mock performance and caching effectiveness

---

## 🎯 Quality Standards

### Test Requirements
- **All tests must pass** before committing
- **Performance tests** must meet established benchmarks
- **Error handling** must be thoroughly tested
- **Edge cases** should be covered
- **Real-world examples** should be included

### Code Coverage Goals
- **Phase 1.1**: 100% mock coverage ✅
- **Future phases**: 95% code coverage minimum
- **Integration tests**: 90% workflow coverage
- **E2E tests**: 100% critical path coverage

### Performance Targets
- **Individual tests**: <100ms each
- **Test suites**: <5s total execution
- **Language detection**: <10ms per file
- **AST operations**: <200ms per file

---

## 📚 Quick Links

### Documentation
- **[Complete Documentation](../docs/claude-code-workflow-automation.md)** - Full testing guide
- **[Testing Plan](../../../testing_plan.md)** - Implementation roadmap
- **[Main README](./README.md)** - Comprehensive overview

### Key Files
- **[Phase 1.1 Runner](./run-phase-1-1-tests.js)** - AST system test execution
- **[Phase 6.1 Runner](./run/run-phase-6-1-tests.js)** - Visual & monitoring test execution
- **[Jest Config](./jest.config.cjs)** - Framework configuration
- **[Test Setup](./setup.js)** - Environment initialization

### External Resources
- **[Jest Docs](https://jestjs.io/docs/getting-started)** - Framework documentation
- **[Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)** - Industry standards

---

## 🚨 Emergency Procedures

### All Tests Failing
1. Check Jest configuration: `npx jest --showConfig`
2. Clear cache: `npx jest --clearCache`
3. Verify Node.js version compatibility
4. Check for missing dependencies

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

---

**Quick Status**: All Phases 1.1-5.2 Complete ✅ | 45+ Test Suites | 1,083+ Tests | Production Ready | Full System Coverage

---

## 📚 Additional Documentation

- **[Enhanced Test Runner Guide](./ENHANCED_TEST_RUNNER.md)**: Complete guide to the advanced test runner with parallel execution, performance regression detection, and CI/CD integration
- **[Main Testing Documentation](./README.md)**: Comprehensive testing overview and navigation
- **[Testing Implementation Index](./TESTING_INDEX.md)**: Detailed phase-by-phase implementation status

*Keep this guide handy for efficient testing workflow with the complete Task Master Flow testing infrastructure!* 