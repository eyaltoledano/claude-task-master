# ListTasks Architecture - End-to-End POC

## Current Implementation Structure

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                            │
│  scripts/modules/task-manager/list-tasks.js                 │
│  - Complex UI rendering (tables, progress bars)             │
│  - Multiple output formats (json, text, markdown, compact)  │
│  - Status filtering and statistics                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Currently reads directly
                              │ from files (needs integration)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      tm-core Package                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            TaskMasterCore (Facade)                   │   │
│  │  src/task-master-core.ts                            │   │
│  │                                                      │   │
│  │  - listTasks(options)                               │   │
│  │    • tag filtering                                  │   │
│  │    • status filtering                               │   │
│  │    • include/exclude subtasks                       │   │
│  │  - getTask(id)                                      │   │
│  │  - getTasksByStatus(status)                         │   │
│  │  - getTaskStats()                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Storage Layer (IStorage)                │   │
│  │                                                      │   │
│  │  ┌──────────────┐        ┌──────────────┐          │   │
│  │  │ FileStorage  │        │ ApiStorage   │          │   │
│  │  │              │        │ (Hamster)    │          │   │
│  │  └──────────────┘        └──────────────┘          │   │
│  │                                                      │   │
│  │  StorageFactory.create() selects based on config    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Domain Layer (Entities)                   │   │
│  │                                                      │   │
│  │  TaskEntity                                         │   │
│  │  - Business logic                                   │   │
│  │  - Validation                                       │   │
│  │  - Status transitions                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## ListTasks Data Flow

### 1. CLI Request
```javascript
// Current CLI (needs update to use tm-core)
listTasks(tasksPath, statusFilter, reportPath, withSubtasks, outputFormat, context)
```

### 2. TaskMasterCore Processing
```typescript
// Our new implementation
const tmCore = createTaskMasterCore(projectPath, { 
  storage: { 
    type: 'api',  // or 'file'
    apiEndpoint: 'https://hamster.ai/api',
    apiAccessToken: 'xxx'
  }
});

const result = await tmCore.listTasks({
  tag: 'feature-branch',
  filter: {
    status: ['pending', 'in-progress'],
    priority: 'high',
    search: 'authentication'
  },
  includeSubtasks: true
});
```

### 3. Storage Selection
```typescript
// StorageFactory automatically selects storage
const storage = StorageFactory.create(config, projectPath);
// Returns either FileStorage or ApiStorage based on config
```

### 4. Data Loading
```typescript
// FileStorage
- Reads from .taskmaster/tasks/tasks.json (or tag-specific file)
- Local file system operations

// ApiStorage (Hamster)
- Makes HTTP requests to Hamster API
- Uses access token from config
- Handles retries and rate limiting
```

### 5. Entity Processing
```typescript
// Convert raw data to TaskEntity for business logic
const taskEntities = TaskEntity.fromArray(rawTasks);

// Apply filters
const filtered = applyFilters(taskEntities, filter);

// Convert back to plain objects
const tasks = filtered.map(entity => entity.toJSON());
```

### 6. Response Structure
```typescript
interface ListTasksResult {
  tasks: Task[];        // Filtered tasks
  total: number;        // Total task count
  filtered: number;     // Filtered task count  
  tag?: string;         // Tag context if applicable
}
```

## Integration Points Needed

### 1. CLI Integration
- [ ] Update `scripts/modules/task-manager/list-tasks.js` to use tm-core
- [ ] Map CLI options to TaskMasterCore options
- [ ] Handle output formatting in CLI layer

### 2. Configuration Loading
- [ ] Load `.taskmaster/config.json` for storage settings
- [ ] Support environment variables for API tokens
- [ ] Handle storage type selection

### 3. Testing Requirements
- [x] Unit tests for TaskEntity
- [x] Unit tests for BaseProvider
- [x] Integration tests for listTasks with FileStorage
- [ ] Integration tests for listTasks with ApiStorage (mock API)
- [ ] E2E tests with real Hamster API (optional)

## Benefits of This Architecture

1. **Storage Abstraction**: Switch between file and API storage without changing business logic
2. **Clean Separation**: UI (CLI) separate from business logic (tm-core)
3. **Testability**: Each layer can be tested independently
4. **Extensibility**: Easy to add new storage types (database, cloud, etc.)
5. **Type Safety**: Full TypeScript support throughout
6. **Error Handling**: Consistent error handling with TaskMasterError

## Next Steps

1. Create a simple CLI wrapper that uses tm-core
2. Test with file storage (existing functionality)
3. Test with mock API storage
4. Integrate with actual Hamster API when available
5. Migrate other commands (addTask, updateTask, etc.) following same pattern