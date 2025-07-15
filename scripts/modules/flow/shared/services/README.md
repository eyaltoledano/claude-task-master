# Task Master Flow Services

This directory contains the service layer for the Task Master Flow TUI application. Services provide the core business logic and external integrations.

## Service Architecture

### Dependency Injection

Services are provided through a React Context-based dependency injection system:

```jsx
import { useServices } from '../shared/contexts/ServiceContext.jsx';

function MyComponent() {
  const { backend, logger, configManager } = useServices();
  // Use services...
}
```

### Service Types

#### Backend Service
Handles all task-related operations:
- Task CRUD operations
- Subtask management
- Tag management
- PRD parsing
- Complexity analysis

#### Logger Service
Provides structured logging:
- `info(message, data)` - Informational messages
- `warn(message, data)` - Warnings
- `error(message, data)` - Errors
- `debug(message, data)` - Debug information
- `success(message, data)` - Success messages

#### Configuration Managers
- `configManager` - Flow application configuration
- `astConfigManager` - AST-specific configuration

#### Branch Manager
Git branch awareness and operations:
- Current branch tracking
- Uncommitted changes detection
- Branch switching

#### Hook Manager
Application lifecycle hooks:
- Register/unregister hooks
- Execute hooks at specific points

#### Provider Registry
AI/service provider management:
- Register providers
- Get provider instances

## Type Safety

### JSDoc Type Definitions

All services have comprehensive JSDoc type definitions:

```javascript
/**
 * @typedef {Object} BackendService
 * @property {function(Object): Promise<{tasks: Array<Task>}>} getTasks
 * @property {function(string): Promise<Task>} getTask
 * // ... more properties
 */
```

### Type Guards

Runtime type checking is available:

```javascript
import { isBackendService, assertService } from './type-guards.js';

// Check if value is valid backend
if (isBackendService(someValue)) {
  // someValue is a valid BackendService
}

// Assert and get typed value
const backend = assertService(someValue, isBackendService, 'Backend');
```

### Service Validation

Services are validated on initialization:

```javascript
import { validateServices } from './interfaces.js';

validateServices({
  backend,
  logger,
  configManager,
  // ... other services
});
```

## Service Factory

Create services programmatically:

```javascript
import { createServices, createTestServices } from './service-factory.js';

// Production services
const services = await createServices({
  backend: myBackend,
  projectRoot: '/path/to/project',
  loggerConfig: { level: 'debug' },
  configOverrides: { theme: 'dark' }
});

// Test services
const testServices = createTestServices({
  backend: { getTasks: jest.fn(() => []) }
});
```

## Testing

### Mock Services

Use the `createMockService` utility:

```javascript
import { createMockService, ServiceInterfaces } from './interfaces.js';

const mockBackend = createMockService(ServiceInterfaces.Backend, {
  getTasks: jest.fn(() => Promise.resolve({ tasks: [] }))
});
```

### Test Service Container

Use `createTestServices` for complete test setup:

```javascript
import { createTestServices } from './service-factory.js';

describe('MyComponent', () => {
  let services;
  
  beforeEach(() => {
    services = createTestServices();
  });
  
  it('should call backend.getTasks', async () => {
    // Test implementation
    expect(services.backend.getTasks).toHaveBeenCalled();
  });
});
```

## Best Practices

1. **Always use dependency injection** - Don't import services directly
2. **Validate services** - Use type guards and validation functions
3. **Log service operations** - Use the logger service for debugging
4. **Handle errors gracefully** - Services may throw errors
5. **Use type definitions** - Leverage JSDoc for better IDE support

## Adding New Services

1. Define the interface in `interfaces.js`:
   ```javascript
   export const ServiceInterfaces = {
     // ... existing interfaces
     MyNewService: {
       doSomething: 'function',
       getSomething: 'function'
     }
   };
   ```

2. Create type guard in `type-guards.js`:
   ```javascript
   export function isMyNewService(value) {
     // Implementation
   }
   ```

3. Update `ServiceContext.jsx` to include the service:
   ```javascript
   const services = {
     // ... existing services
     myNewService: new MyNewService()
   };
   ```

4. Update validation and factory functions

## Service Dependencies

Services may depend on each other. The initialization order in `ServiceContext.jsx` ensures dependencies are satisfied:

1. Logger (no dependencies)
2. Configuration Managers (depend on logger)
3. Branch Manager (depends on backend, logger)
4. Hook Manager (depends on logger)
5. Provider Registry (depends on logger) 