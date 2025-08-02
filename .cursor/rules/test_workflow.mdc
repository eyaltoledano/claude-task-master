---
description: 
globs: 
alwaysApply: true
---
# Test Workflow & Development Process

## **Initial Testing Framework Setup**

Before implementing the TDD workflow, ensure your project has a proper testing framework configured. This section covers setup for different technology stacks.

### **Detecting Project Type & Framework Needs**

**AI Agent Assessment Checklist:**
1. **Language Detection**: Check for `package.json` (Node.js/JavaScript), `requirements.txt` (Python), `Cargo.toml` (Rust), etc.
2. **Existing Tests**: Look for test files (`.test.`, `.spec.`, `_test.`) or test directories
3. **Framework Detection**: Check for existing test runners in dependencies
4. **Project Structure**: Analyze directory structure for testing patterns

### **JavaScript/Node.js Projects (Jest Setup)**

#### **Prerequisites Check**
```bash
# Verify Node.js project
ls package.json  # Should exist

# Check for existing testing setup
ls jest.config.js jest.config.ts  # Check for Jest config
grep -E "(jest|vitest|mocha)" package.json  # Check for test runners
```

#### **Jest Installation & Configuration**

**Step 1: Install Dependencies**
```bash
# Core Jest dependencies
npm install --save-dev jest

# TypeScript support (if using TypeScript)
npm install --save-dev ts-jest @types/jest

# Additional useful packages
npm install --save-dev supertest @types/supertest  # For API testing
npm install --save-dev jest-watch-typeahead  # Enhanced watch mode
```

**Step 2: Create Jest Configuration**

Create `jest.config.js` with the following production-ready configuration:

```javascript
/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Roots for test discovery
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  // Test file patterns
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],

  // Transform files
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'es2020',
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          strict: false,
          noImplicitAny: false,
        },
      },
    ],
    '^.+\\.js$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          target: 'es2020',
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          allowJs: true,
        },
      },
    ],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Transform ignore patterns - adjust for ES modules
  transformIgnorePatterns: ['node_modules/(?!(your-es-module-deps|.*\\.mjs$))'],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text', // Console output
    'text-summary', // Brief summary
    'lcov', // For IDE integration
    'html', // Detailed HTML report
  ],

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts', // Often just exports
    '!src/generated/**', // Generated code
    '!src/config/database.ts', // Database config (tested via integration)
  ],

  // Coverage thresholds - TaskMaster standards
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Higher standards for critical business logic
    './src/utils/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/middleware/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Global teardown to prevent worker process leaks
  globalTeardown: '<rootDir>/tests/teardown.ts',

  // Module path mapping (if needed)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Global test timeout
  testTimeout: 10000,

  // Projects for different test types
  projects: [
    // Unit tests - for pure functions only
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: ['.*\\.integration\\.test\\.ts$', '/tests/'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/*.test.ts',
        '!src/**/*.integration.test.ts',
      ],
      coverageThreshold: {
        global: {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    // Integration tests - real database/services
    {
      displayName: 'integration',
      testMatch: [
        '<rootDir>/src/**/*.integration.test.ts',
        '<rootDir>/tests/integration/**/*.test.ts',
      ],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.ts'],
      testTimeout: 10000,
    },
    // E2E tests - full workflows
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e.ts'],
      testTimeout: 30000,
    },
  ],

  // Verbose output for better debugging
  verbose: true,

  // Run projects sequentially to avoid conflicts
  maxWorkers: 1,

  // Enable watch mode plugins
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
};
```

**Step 3: Update package.json Scripts**

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --selectProjects unit",
    "test:integration": "jest --selectProjects integration", 
    "test:e2e": "jest --selectProjects e2e",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

**Step 4: Create Test Setup Files**

Create essential test setup files:

```typescript
// tests/setup.ts - Global setup
import { jest } from '@jest/globals';

// Global test configuration
beforeAll(() => {
  // Set test timeout
  jest.setTimeout(10000);
});

afterEach(() => {
  // Clean up mocks after each test
  jest.clearAllMocks();
});
```

```typescript
// tests/setup/integration.ts - Integration test setup
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
});

afterAll(async () => {
  // Cleanup and disconnect
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean test data before each test
  // Add your cleanup logic here
});
```

```typescript
// tests/teardown.ts - Global teardown
export default async () => {
  // Global cleanup after all tests
  console.log('Global test teardown complete');
};
```

**Step 5: Create Initial Test Structure**

```bash
# Create test directories
mkdir -p tests/{setup,fixtures,unit,integration,e2e}
mkdir -p tests/unit/src/{utils,services,middleware}

# Create sample test fixtures
mkdir tests/fixtures
```

### **Generic Testing Framework Setup (Any Language)**

#### **Framework Selection Guide**

**Python Projects:**
- **pytest**: Recommended for most Python projects
- **unittest**: Built-in, suitable for simple projects
- **Coverage**: Use `coverage.py` for code coverage

```bash
# Python setup example
pip install pytest pytest-cov
echo "[tool:pytest]" > pytest.ini
echo "testpaths = tests" >> pytest.ini
echo "addopts = --cov=src --cov-report=html --cov-report=term" >> pytest.ini
```

**Go Projects:**
- **Built-in testing**: Use Go's built-in `testing` package
- **Coverage**: Built-in with `go test -cover`

```bash
# Go setup example
go mod init your-project
mkdir -p tests
# Tests are typically *_test.go files alongside source
```

**Rust Projects:**
- **Built-in testing**: Use Rust's built-in test framework
- **cargo-tarpaulin**: For coverage analysis

```bash
# Rust setup example
cargo new your-project
cd your-project
cargo install cargo-tarpaulin  # For coverage
```

**Java Projects:**
- **JUnit 5**: Modern testing framework
- **Maven/Gradle**: Build tools with testing integration

```xml
<!-- Maven pom.xml example -->
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.9.2</version>
    <scope>test</scope>
</dependency>
```

#### **Universal Testing Principles**

**Coverage Standards (Adapt to Your Language):**
- **Global Minimum**: 70-80% line coverage
- **Critical Code**: 85-90% coverage
- **New Features**: Must meet or exceed standards
- **Legacy Code**: Gradual improvement strategy

**Test Organization:**
- **Unit Tests**: Fast, isolated, no external dependencies
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Load and stress testing (if applicable)

**Naming Conventions:**
- **Test Files**: `*.test.*`, `*_test.*`, or language-specific patterns
- **Test Functions**: Descriptive names (e.g., `should_return_error_for_invalid_input`)
- **Test Directories**: Organized by test type and mirroring source structure

#### **TaskMaster Integration for Any Framework**

**Document Testing Setup in Subtasks:**
```bash
# Update subtask with testing framework setup
task-master update-subtask --id=X.Y --prompt="Testing framework setup:
- Installed [Framework Name] with coverage support
- Configured [Coverage Tool] with thresholds: 80% lines, 70% branches
- Created test directory structure: unit/, integration/, e2e/
- Added test scripts to build configuration
- All setup tests passing"
```

**Testing Framework Verification:**
```bash
# Verify setup works
[test-command]  # e.g., npm test, pytest, go test, cargo test

# Check coverage reporting
[coverage-command]  # e.g., npm run test:coverage

# Update task with verification
task-master update-subtask --id=X.Y --prompt="Testing framework verified:
- Sample tests running successfully
- Coverage reporting functional
- CI/CD integration ready
- Ready to begin TDD workflow"
```

## **Test-Driven Development (TDD) Integration**

### **Core TDD Cycle with Jest**
```bash
# 1. Start development with watch mode
npm run test:watch

# 2. Write failing test first
# Create test file: src/utils/newFeature.test.ts
# Write test that describes expected behavior

# 3. Implement minimum code to make test pass
# 4. Refactor while keeping tests green
# 5. Add edge cases and error scenarios
```

### **TDD Workflow Per Subtask**
```bash
# When starting a new subtask:
task-master set-status --id=4.1 --status=in-progress

# Begin TDD cycle:
npm run test:watch  # Keep running during development

# Document TDD progress in subtask:
task-master update-subtask --id=4.1 --prompt="TDD Progress:
- Written 3 failing tests for core functionality
- Implemented basic feature, tests now passing
- Adding edge case tests for error handling"

# Complete subtask with test summary:
task-master update-subtask --id=4.1 --prompt="Implementation complete:
- Feature implemented with 8 unit tests
- Coverage: 95% statements, 88% branches  
- All tests passing, TDD cycle complete"
```

## **Testing Commands & Usage**

### **Development Commands**
```bash
# Primary development command - use during coding
npm run test:watch              # Watch mode with Jest
npm run test:watch -- --testNamePattern="auth"  # Watch specific tests

# Targeted testing during development
npm run test:unit               # Run only unit tests
npm run test:unit -- --coverage # Unit tests with coverage

# Integration testing when APIs are ready
npm run test:integration        # Run integration tests
npm run test:integration -- --detectOpenHandles  # Debug hanging tests

# End-to-end testing for workflows
npm run test:e2e               # Run E2E tests
npm run test:e2e -- --timeout=30000  # Extended timeout for E2E
```

### **Quality Assurance Commands**
```bash
# Full test suite with coverage (before commits)
npm run test:coverage          # Complete coverage analysis

# All tests (CI/CD pipeline)
npm test                       # Run all test projects

# Specific test file execution
npm test -- auth.test.ts       # Run specific test file
npm test -- --testNamePattern="should handle errors"  # Run specific tests
```

## **Test Implementation Patterns**

### **Unit Test Development**
```typescript
// ✅ DO: Follow established patterns from auth.test.ts
describe('FeatureName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup mocks with proper typing
  });

  describe('functionName', () => {
    it('should handle normal case', () => {
      // Test implementation with specific assertions
    });
    
    it('should throw error for invalid input', async () => {
      // Error scenario testing
      await expect(functionName(invalidInput))
        .rejects.toThrow('Specific error message');
    });
  });
});
```

### **Integration Test Development**  
```typescript
// ✅ DO: Use supertest for API endpoint testing
import request from 'supertest';
import { app } from '../../src/app';

describe('POST /api/auth/register', () => {
  beforeEach(async () => {
    await integrationTestUtils.cleanupTestData();
  });
  
  it('should register user successfully', async () => {
    const userData = createTestUser();
    
    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);
      
    expect(response.body).toMatchObject({
      id: expect.any(String),
      email: userData.email
    });
    
    // Verify database state
    const user = await prisma.user.findUnique({
      where: { email: userData.email }
    });
    expect(user).toBeTruthy();
  });
});
```

### **E2E Test Development**
```typescript
// ✅ DO: Test complete user workflows
describe('User Authentication Flow', () => {
  it('should complete registration → login → protected access', async () => {
    // Step 1: Register
    const userData = createTestUser();
    await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);
    
    // Step 2: Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: userData.email, password: userData.password })
      .expect(200);
    
    const { token } = loginResponse.body;
    
    // Step 3: Access protected resource
    await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  }, 30000); // Extended timeout for E2E
});
```

## **Mocking & Test Utilities**

### **Established Mocking Patterns**
```typescript
// ✅ DO: Use established bcrypt mocking pattern
jest.mock('bcrypt');
import bcrypt from 'bcrypt';
const mockHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

// ✅ DO: Use Prisma mocking for unit tests
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  })),
}));
```

### **Test Fixtures Usage**
```typescript
// ✅ DO: Use centralized test fixtures
import { createTestUser, adminUser, invalidUser } from '../fixtures/users';

describe('User Service', () => {
  it('should handle admin user creation', async () => {
    const userData = createTestUser(adminUser);
    // Test implementation
  });
  
  it('should reject invalid user data', async () => {
    const userData = createTestUser(invalidUser);
    // Error testing
  });
});
```

## **Coverage Standards & Monitoring**

### **Coverage Thresholds**
- **Global Standards**: 80% lines/functions, 70% branches
- **Critical Code**: 90% utils, 85% middleware
- **New Features**: Must meet or exceed global thresholds
- **Legacy Code**: Gradual improvement with each change

### **Coverage Reporting & Analysis**
```bash
# Generate coverage reports
npm run test:coverage

# View detailed HTML report
open coverage/lcov-report/index.html

# Coverage files generated:
# - coverage/lcov-report/index.html  # Detailed HTML report
# - coverage/lcov.info               # LCOV format for IDE integration  
# - coverage/coverage-final.json     # JSON format for tooling
```

### **Coverage Quality Checks**
```typescript
// ✅ DO: Test all code paths
describe('validateInput', () => {
  it('should return true for valid input', () => {
    expect(validateInput('valid')).toBe(true);
  });
  
  it('should return false for various invalid inputs', () => {
    expect(validateInput('')).toBe(false);      // Empty string
    expect(validateInput(null)).toBe(false);    // Null value
    expect(validateInput(undefined)).toBe(false); // Undefined
  });
  
  it('should throw for unexpected input types', () => {
    expect(() => validateInput(123)).toThrow('Invalid input type');
  });
});
```

## **Testing During Development Phases**

### **Feature Development Phase**
```bash
# 1. Start feature development
task-master set-status --id=X.Y --status=in-progress

# 2. Begin TDD cycle  
npm run test:watch

# 3. Document test progress in subtask
task-master update-subtask --id=X.Y --prompt="Test development:
- Created test file with 5 failing tests
- Implemented core functionality
- Tests passing, adding error scenarios"

# 4. Verify coverage before completion
npm run test:coverage

# 5. Update subtask with final test status
task-master update-subtask --id=X.Y --prompt="Testing complete:
- 12 unit tests with full coverage
- All edge cases and error scenarios covered
- Ready for integration testing"
```

### **Integration Testing Phase**
```bash
# After API endpoints are implemented
npm run test:integration

# Update integration test templates
# Replace placeholder tests with real endpoint calls

# Document integration test results
task-master update-subtask --id=X.Y --prompt="Integration tests:
- Updated auth endpoint tests  
- Database integration verified
- All HTTP status codes and responses tested"
```

### **Pre-Commit Testing Phase**
```bash
# Before committing code
npm run test:coverage         # Verify all tests pass with coverage
npm run test:unit            # Quick unit test verification
npm run test:integration     # Integration test verification (if applicable)

# Commit pattern for test updates
git add tests/ src/**/*.test.ts
git commit -m "test(task-X): Add comprehensive tests for Feature Y

- Unit tests with 95% coverage (exceeds 90% threshold)
- Integration tests for API endpoints
- Test fixtures for data generation
- Proper mocking patterns established

Task X: Feature Y - Testing complete"
```

## **Error Handling & Debugging**

### **Test Debugging Techniques**
```typescript
// ✅ DO: Use test utilities for debugging
import { testUtils } from '../setup';

it('should debug complex operation', () => {
  testUtils.withConsole(() => {
    // Console output visible only for this test
    console.log('Debug info:', complexData);
    service.complexOperation();
  });
});

// ✅ DO: Use proper async debugging
it('should handle async operations', async () => {
  const promise = service.asyncOperation();
  
  // Test intermediate state
  expect(service.isProcessing()).toBe(true);
  
  const result = await promise;
  expect(result).toBe('expected');
  expect(service.isProcessing()).toBe(false);
});
```

### **Common Test Issues & Solutions**
```bash
# Hanging tests (common with database connections)
npm run test:integration -- --detectOpenHandles

# Memory leaks in tests
npm run test:unit -- --logHeapUsage

# Slow tests identification
npm run test:coverage -- --verbose

# Mock not working properly
# Check: mock is declared before imports
# Check: jest.clearAllMocks() in beforeEach
# Check: TypeScript typing is correct
```

## **Continuous Integration Integration**

### **CI/CD Pipeline Testing**
```yaml
# Example GitHub Actions integration
- name: Run tests
  run: |
    npm ci
    npm run test:coverage
    
- name: Upload coverage reports
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

### **Pre-commit Hooks**
```bash
# Setup pre-commit testing (recommended)
# In package.json scripts:
"pre-commit": "npm run test:unit && npm run test:integration"

# Husky integration example:
npx husky add .husky/pre-commit "npm run test:unit"
```

## **Test Maintenance & Evolution**

### **Adding Tests for New Features**
1. **Create test file** alongside source code or in `tests/unit/`
2. **Follow established patterns** from `src/utils/auth.test.ts`
3. **Use existing fixtures** from `tests/fixtures/`
4. **Apply proper mocking** patterns for dependencies
5. **Meet coverage thresholds** for the module

### **Updating Integration/E2E Tests**
1. **Update templates** in `tests/integration/` when APIs change
2. **Modify E2E workflows** in `tests/e2e/` for new user journeys  
3. **Update test fixtures** for new data requirements
4. **Maintain database cleanup** utilities

### **Test Performance Optimization**
- **Parallel execution**: Jest runs tests in parallel by default
- **Test isolation**: Use proper setup/teardown for independence
- **Mock optimization**: Mock heavy dependencies appropriately  
- **Database efficiency**: Use transaction rollbacks where possible

---

**Key References:**
- [Testing Standards](mdc:.cursor/rules/tests.mdc)
- [Git Workflow](mdc:.cursor/rules/git_workflow.mdc)
- [Development Workflow](mdc:.cursor/rules/dev_workflow.mdc)
- [Jest Configuration](mdc:jest.config.js)