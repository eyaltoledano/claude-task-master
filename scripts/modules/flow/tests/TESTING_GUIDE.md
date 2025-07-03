# Task Master Flow - Testing Quick Reference Guide

## 🚀 Quick Commands

### Run All Phase 1.1 Tests
```bash
cd scripts/modules/flow/tests
node run-phase-1-1-tests.js
```

### Run All Phase 6.1 Tests
```bash
cd scripts/modules/flow/tests
node run/run-phase-6-1-tests.js
```

### Run Specific Test Categories
```bash
# Language Detection (46 tests)
npx jest unit/ast/language-detector.test.js --verbose

# All Parser Tests (90+ tests)
npx jest unit/ast/parsers/ --verbose

# AST Generation & Validation (35+ tests)  
npx jest unit/ast/ast-generation.test.js --verbose

# Code Analyzers (20+ tests)
npx jest unit/ast/analyzers.test.js --verbose

# Parser Registry (25+ tests)
npx jest unit/ast/parser-registry.test.js --verbose

# Monitoring Dashboard (15+ tests)
cd scripts/modules/flow/tests && npx jest visual/monitoring-dashboard.test.js --verbose

# Configuration Modal (20+ tests)
cd scripts/modules/flow/tests && npx jest visual/configuration-modal.test.js --verbose

# Notification Display (18+ tests)  
cd scripts/modules/flow/tests && npx jest visual/notification-display.test.js --verbose

# Theme Integration (25+ tests)
cd scripts/modules/flow/tests && npx jest visual/theme-integration.test.js --verbose
```

### Development Commands
```bash
# Watch mode for active development
npx jest --watch unit/ast/

# Run with coverage
npx jest --coverage

# Debug specific test
npx jest unit/ast/language-detector.test.js --verbose --no-cache

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

### Phase 6.1 - Visual & Monitoring Testing (COMPLETE)
```
visual/
├── monitoring-dashboard.test.js       # 15+ tests - Real-time display & metrics
├── configuration-modal.test.js        # 20+ tests - Settings & form validation
├── notification-display.test.js       # 18+ tests - Notification system
└── theme-integration.test.js          # 25+ tests - Theme consistency & accessibility
```

### Future Phases (PLANNED)
```
unit/
├── services/          # Phase 2.1 - Background services
├── hooks/             # Phase 2.2 - Hook system  
└── worktree/          # Phase 2.3 - Git integration

integration/           # Phase 3 - System integration
e2e/                   # Phase 4 - End-to-end workflows
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

**Quick Status**: Phase 1.1 Complete ✅ | Phase 6.1 Complete ✅ | 11 Total Suites | 280+ Tests | ~8s Runtime

*Keep this guide handy for efficient testing workflow!* 