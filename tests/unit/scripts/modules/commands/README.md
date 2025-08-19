# Mock System Documentation

## Overview

The `move-cross-tag.test.js` file has been refactored to use a focused, maintainable mock system that addresses the brittleness and complexity of the original implementation.

## Key Improvements

### 1. **Focused Mocking**

- **Before**: Mocked 20+ modules, many irrelevant to cross-tag functionality
- **After**: Only mocks 5 core modules actually used in cross-tag moves

### 2. **Configuration-Driven Mocking**

```javascript
const mockConfig = {
  core: {
    moveTasksBetweenTags: true,
    generateTaskFiles: true,
    readJSON: true,
    initTaskMaster: true,
    findProjectRoot: true
  }
};
```

### 3. **Reusable Mock Factory**

```javascript
function createMockFactory(config = mockConfig) {
  const mocks = {};
  
  if (config.core?.moveTasksBetweenTags) {
    mocks.moveTasksBetweenTags = createMock('moveTasksBetweenTags');
  }
  // ... other mocks
  
  return mocks;
}
```

## Mock Configuration

### Core Mocks (Required for Cross-Tag Functionality)

- `moveTasksBetweenTags`: Core move functionality
- `generateTaskFiles`: File generation after moves
- `readJSON`: Reading task data
- `initTaskMaster`: TaskMaster initialization
- `findProjectRoot`: Project path resolution

### Optional Mocks

- Console methods: `error`, `log`, `exit`
- TaskMaster instance methods: `getCurrentTag`, `getTasksPath`, `getProjectRoot`

## Usage Examples

### Default Configuration

```javascript
const mocks = setupMocks(); // Uses default mockConfig
```

### Minimal Configuration

```javascript
const minimalConfig = {
  core: {
    moveTasksBetweenTags: true,
    generateTaskFiles: true,
    readJSON: true
  }
};
const mocks = setupMocks(minimalConfig);
```

### Selective Mocking

```javascript
const selectiveConfig = {
  core: {
    moveTasksBetweenTags: true,
    generateTaskFiles: false, // Disabled
    readJSON: true
  }
};
const mocks = setupMocks(selectiveConfig);
```

## Benefits

1. **Reduced Complexity**: From 150+ lines of mock setup to 50 lines
2. **Better Maintainability**: Clear configuration object shows dependencies
3. **Focused Testing**: Only mocks what's actually used
4. **Flexible Configuration**: Easy to enable/disable specific mocks
5. **Consistent Naming**: All mocks use `createMock()` with descriptive names

## Migration Guide

### For Other Test Files

1. Identify actual module dependencies
2. Create configuration object for required mocks
3. Use `createMockFactory()` and `setupMocks()`
4. Remove unnecessary mocks

### Example Migration

```javascript
// Before: 20+ jest.mock() calls
jest.mock('module1', () => ({ ... }));
jest.mock('module2', () => ({ ... }));
// ... many more

// After: Configuration-driven
const mockConfig = {
  core: {
    requiredFunction1: true,
    requiredFunction2: true
  }
};
const mocks = setupMocks(mockConfig);
```

## Testing the Mock System

The test suite includes validation tests:

- `should work with minimal mock configuration`
- `should allow disabling specific mocks`

These ensure the mock factory works correctly and can be configured flexibly.
