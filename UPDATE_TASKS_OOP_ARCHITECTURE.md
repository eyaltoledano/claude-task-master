# Update-Tasks OOP Architecture Design

**Storage-Aware Strategy Pattern with Proper Layer Separation**

## Core Architectural Principle

**File storage vs API storage require fundamentally different update workflows:**
- **File storage (local)**: Client-side AI orchestration - load → context → AI → merge → save
- **API storage (remote)**: Server-side AI orchestration - delegate entire workflow to API endpoint

**Solution**: Use Strategy Pattern to cleanly separate these two workflows while maintaining a unified interface.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│              DOMAIN LAYER (Public API)              │
│                   TasksDomain                       │
│   Exposes business capabilities to consumers        │
│   - updateBulk(fromId, prompt, options)             │
│   - updateSingle(taskId, prompt, options)           │
│   - updateSubtask(subtaskId, prompt, options)       │
└──────────────────────┬──────────────────────────────┘
                       │ delegates to
┌──────────────────────▼──────────────────────────────┐
│         APPLICATION LAYER (Orchestration)           │
│              TaskUpdateService                      │
│   Orchestrates domain operations                    │
│   - No storage type branching                       │
│   - No AI knowledge                                 │
│   - Pure delegation to strategy                     │
└──────────────────────┬──────────────────────────────┘
                       │ uses strategy
┌──────────────────────▼──────────────────────────────┐
│          STRATEGY LAYER (Workflows)                 │
│                                                     │
│           ITaskUpdateStrategy (interface)           │
│                       │                             │
│         ┌─────────────┴─────────────┐              │
│         │                           │              │
│  LocalTaskUpdateStrategy    RemoteTaskUpdateStrategy│
│  (File storage workflow)   (API storage workflow)  │
│                                                     │
│  Full AI orchestration:    Delegates to server:    │
│  - Load from file          - POST /bulk-update     │
│  - Gather context          - Server does AI        │
│  - Build prompts           - Server saves          │
│  - Call AI                                         │
│  - Merge results                                   │
│  - Save to file                                    │
└──────────────────────┬──────────────────────────────┘
                       │ uses services
┌──────────────────────▼──────────────────────────────┐
│       INFRASTRUCTURE LAYER (Implementation)         │
│                                                     │
│  Domain Services:                                   │
│  - AIService           (AI operations)              │
│  - ContextGatherer     (context building)           │
│  - PromptBuilderService (prompt construction)       │
│  - TaskMergerService   (result merging)             │
│                                                     │
│  Infrastructure:                                    │
│  - IStorage            (persistence abstraction)    │
│  - ApiClient           (HTTP communication)         │
│  - PromptManager       (prompt templates)           │
│  - FuzzyTaskSearch     (task relevance search)      │
└─────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### 1. Domain Layer (What can be done)
**Purpose**: Define business capabilities and expose unified API

```typescript
// packages/tm-core/src/modules/tasks/tasks-domain.ts

export class TasksDomain {
  private taskUpdateService: TaskUpdateService;

  constructor(configManager: ConfigManager) {
    this.taskUpdateService = new TaskUpdateService(configManager);
  }

  /**
   * Update multiple tasks from a starting ID
   * Works identically regardless of storage type
   */
  async updateBulk(
    fromId: number,
    prompt: string,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    return this.taskUpdateService.updateBulk(fromId, prompt, options);
  }

  /**
   * Update a single task by ID
   */
  async updateSingle(
    taskId: string,
    prompt: string,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    return this.taskUpdateService.updateSingle(taskId, prompt, options);
  }

  /**
   * Update a subtask with timestamped append
   */
  async updateSubtask(
    subtaskId: string,
    prompt: string,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    return this.taskUpdateService.updateSubtask(subtaskId, prompt, options);
  }
}
```

**Responsibilities**:
- ✅ Expose clean business API
- ✅ Delegate to application layer
- ❌ No storage concerns
- ❌ No AI concerns
- ❌ No HTTP concerns

---

### 2. Application Layer (How it's orchestrated)
**Purpose**: Coordinate domain operations using appropriate strategy

```typescript
// packages/tm-core/src/modules/tasks/services/task-update.service.ts

export class TaskUpdateService {
  private strategy: ITaskUpdateStrategy;

  constructor(
    private configManager: ConfigManager,
    private storage: IStorage,
    private strategyFactory: TaskUpdateStrategyFactory
  ) {
    // Factory creates appropriate strategy based on storage type
    this.strategy = this.strategyFactory.create(storage);
  }

  async updateBulk(
    fromId: number,
    prompt: string,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    // Pure delegation - no branching on storage type here
    return this.strategy.updateBulk(fromId, prompt, options);
  }

  async updateSingle(
    taskId: string,
    prompt: string,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    return this.strategy.updateSingle(taskId, prompt, options);
  }

  async updateSubtask(
    subtaskId: string,
    prompt: string,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    return this.strategy.updateSubtask(subtaskId, prompt, options);
  }
}
```

**Responsibilities**:
- ✅ Orchestrate operations
- ✅ Delegate to correct strategy
- ❌ No knowledge of storage implementation
- ❌ No knowledge of AI implementation
- ❌ No if/else branching on storage type (factory handles this)

---

### 3. Strategy Layer (What workflow to execute)
**Purpose**: Implement different update workflows based on storage type

#### Strategy Interface

```typescript
// packages/tm-core/src/modules/tasks/strategies/task-update-strategy.interface.ts

export interface ITaskUpdateStrategy {
  /**
   * Update multiple tasks from a starting ID
   */
  updateBulk(
    fromId: number,
    prompt: string,
    options?: UpdateOptions
  ): Promise<UpdateResult>;

  /**
   * Update a single task
   */
  updateSingle(
    taskId: string,
    prompt: string,
    options?: UpdateOptions
  ): Promise<UpdateResult>;

  /**
   * Update a subtask with timestamped content
   */
  updateSubtask(
    subtaskId: string,
    prompt: string,
    options?: UpdateOptions
  ): Promise<UpdateResult>;
}

export interface UpdateOptions {
  tag?: string;
  useResearch?: boolean;
  session?: any; // MCP session
  projectRoot?: string;
}

export interface UpdateResult {
  success: boolean;
  updatedTasks?: Task[];
  updatedSubtask?: Subtask;
  updateCount: number;
  telemetryData?: TelemetryData;
  tagInfo?: TagInfo;
}
```

#### Local Strategy (File Storage)

```typescript
// packages/tm-core/src/modules/tasks/strategies/local-task-update.strategy.ts

/**
 * LOCAL STRATEGY - File storage with client-side AI
 * Performs full orchestration: load → context → AI → merge → save
 */
export class LocalTaskUpdateStrategy implements ITaskUpdateStrategy {
  constructor(
    private storage: IStorage,
    private aiService: AIService,
    private contextGatherer: ContextGatherer,
    private promptBuilder: PromptBuilderService,
    private taskMerger: TaskMergerService,
    private logger: Logger
  ) {}

  async updateBulk(
    fromId: number,
    prompt: string,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    this.logger.info(`Starting bulk update from ID ${fromId}`);

    // STEP 1: Load all tasks from file storage
    const allTasks = await this.storage.loadTasks(options.tag);

    // STEP 2: Filter tasks to update (id >= fromId AND status !== 'done')
    const tasksToUpdate = allTasks.filter(task =>
      task.id >= fromId && task.status !== 'done'
    );

    if (tasksToUpdate.length === 0) {
      this.logger.info('No tasks to update');
      return {
        success: true,
        updatedTasks: [],
        updateCount: 0
      };
    }

    // STEP 3: Gather context using ContextGatherer + FuzzyTaskSearch
    const context = await this.contextGatherer.gather({
      tasks: tasksToUpdate,
      prompt,
      allTasks,
      mode: 'update'
    });

    // STEP 4: Build prompts using PromptManager
    const prompts = await this.promptBuilder.build('update-tasks', {
      tasks: tasksToUpdate,
      updatePrompt: prompt,
      projectContext: context,
      useResearch: options.useResearch,
      hasCodebaseAnalysis: this.hasCodebaseAnalysis(options),
      projectRoot: options.projectRoot
    });

    // STEP 5: Call AI service
    const aiResult = await this.aiService.generateObject({
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      schema: UPDATE_TASKS_SCHEMA,
      role: options.useResearch ? 'research' : 'main',
      session: options.session,
      projectRoot: options.projectRoot
    });

    // STEP 6: Merge AI results with existing tasks
    const updatedTaskList = this.taskMerger.mergeBulkUpdate(
      allTasks,
      aiResult.tasks
    );

    // STEP 7: Save back to file storage
    await this.storage.saveTasks(updatedTaskList, options.tag);

    this.logger.info(`Successfully updated ${aiResult.tasks.length} tasks`);

    return {
      success: true,
      updatedTasks: aiResult.tasks,
      updateCount: aiResult.tasks.length,
      telemetryData: aiResult.telemetry,
      tagInfo: aiResult.tagInfo
    };
  }

  async updateSingle(
    taskId: string,
    prompt: string,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    // Similar flow:
    // 1. Load tasks
    // 2. Find specific task
    // 3. Gather context for this task
    // 4. Build prompts
    // 5. Call AI
    // 6. Merge result
    // 7. Save
  }

  async updateSubtask(
    subtaskId: string,
    prompt: string,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    // Similar flow but:
    // - Uses generateText (not generateObject)
    // - Appends timestamped content
    // - Different prompt template
  }

  private hasCodebaseAnalysis(options: UpdateOptions): boolean {
    // Check if codebase analysis is available
    return false; // Implementation detail
  }
}
```

#### Remote Strategy (API Storage)

```typescript
// packages/tm-core/src/modules/tasks/strategies/remote-task-update.strategy.ts

/**
 * REMOTE STRATEGY - API storage with server-side AI
 * Delegates entire workflow to server endpoint
 */
export class RemoteTaskUpdateStrategy implements ITaskUpdateStrategy {
  constructor(
    private apiClient: ApiClient,
    private projectId: string,
    private logger: Logger
  ) {}

  async updateBulk(
    fromId: number,
    prompt: string,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    this.logger.info(`Delegating bulk update to API server`);

    // Server handles everything:
    // - Load tasks from database
    // - Gather context
    // - Call AI
    // - Merge results
    // - Save to database
    const result = await this.apiClient.post(
      `/projects/${this.projectId}/tasks/bulk-update`,
      {
        fromId,
        prompt,
        useResearch: options.useResearch,
        tag: options.tag
      }
    );

    return result;
  }

  async updateSingle(
    taskId: string,
    prompt: string,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    const result = await this.apiClient.post(
      `/projects/${this.projectId}/tasks/${taskId}/update`,
      {
        prompt,
        useResearch: options.useResearch,
        tag: options.tag
      }
    );

    return result;
  }

  async updateSubtask(
    subtaskId: string,
    prompt: string,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    const [taskId, subtaskIndex] = subtaskId.split('.');

    const result = await this.apiClient.post(
      `/projects/${this.projectId}/tasks/${taskId}/subtasks/${subtaskIndex}/update`,
      {
        prompt,
        useResearch: options.useResearch,
        tag: options.tag
      }
    );

    return result;
  }
}
```

**Strategy Responsibilities**:
- ✅ Implement complete update workflow
- ✅ Local: Full AI orchestration with all dependencies
- ✅ Remote: Simple API delegation
- ❌ No knowledge of other strategies
- ❌ No storage type detection (factory handles this)

---

### 4. Infrastructure Layer (How it's implemented)

#### Factory Pattern

```typescript
// packages/tm-core/src/modules/tasks/factories/task-update-strategy.factory.ts

export class TaskUpdateStrategyFactory {
  constructor(
    private aiService: AIService,
    private contextGatherer: ContextGatherer,
    private promptBuilder: PromptBuilderService,
    private taskMerger: TaskMergerService,
    private logger: Logger
  ) {}

  /**
   * Create appropriate strategy based on storage type
   * This is the ONLY place where storage type detection happens
   */
  create(storage: IStorage): ITaskUpdateStrategy {
    const storageType = storage.getStorageType();

    if (storageType === 'file') {
      this.logger.info('Creating LocalTaskUpdateStrategy for file storage');

      return new LocalTaskUpdateStrategy(
        storage,
        this.aiService,
        this.contextGatherer,
        this.promptBuilder,
        this.taskMerger,
        this.logger
      );
    } else if (storageType === 'api') {
      this.logger.info('Creating RemoteTaskUpdateStrategy for API storage');

      // Extract API client and project ID from API storage
      const apiStorage = storage as ApiStorage;
      const apiClient = apiStorage.getApiClient();
      const projectId = apiStorage.getProjectId();

      return new RemoteTaskUpdateStrategy(
        apiClient,
        projectId,
        this.logger
      );
    } else {
      throw new TaskMasterError(
        `Unsupported storage type: ${storageType}`,
        ERROR_CODES.INVALID_CONFIGURATION
      );
    }
  }
}
```

#### Supporting Services

```typescript
// packages/tm-core/src/modules/tasks/services/task-merger.service.ts

/**
 * Handles merging AI results with existing tasks
 * Pure business logic - no I/O
 */
export class TaskMergerService {
  /**
   * Merge bulk update results
   */
  mergeBulkUpdate(
    existingTasks: Task[],
    updatedTasks: Task[]
  ): Task[] {
    const updateMap = new Map(
      updatedTasks.map(t => [t.id, t])
    );

    return existingTasks.map(task => {
      if (updateMap.has(task.id)) {
        const updated = updateMap.get(task.id)!;
        return {
          ...task,           // Keep all existing fields
          ...updated,        // Override with updated fields
          // Preserve subtasks if not provided by AI
          subtasks: updated.subtasks !== undefined
            ? updated.subtasks
            : task.subtasks
        };
      }
      return task;
    });
  }

  /**
   * Merge single task update
   */
  mergeSingleUpdate(
    existingTasks: Task[],
    taskId: string,
    updatedTask: Task
  ): Task[] {
    return existingTasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          ...updatedTask,
          subtasks: updatedTask.subtasks !== undefined
            ? updatedTask.subtasks
            : task.subtasks
        };
      }
      return task;
    });
  }

  /**
   * Merge subtask update with timestamped content
   */
  mergeSubtaskUpdate(
    parentTask: Task,
    subtaskIndex: number,
    content: string,
    prompt: string
  ): { task: Task; newlyAddedSnippet: string } {
    if (!parentTask.subtasks || !parentTask.subtasks[subtaskIndex]) {
      throw new TaskMasterError(
        `Subtask ${subtaskIndex} not found in task ${parentTask.id}`,
        ERROR_CODES.TASK_NOT_FOUND
      );
    }

    const subtask = parentTask.subtasks[subtaskIndex];
    const timestamp = new Date().toISOString();
    const formatted = `<info added on ${timestamp}>\n${content.trim()}\n</info added on ${timestamp}>`;

    // Append to details
    subtask.details = subtask.details
      ? `${subtask.details}\n\n${formatted}`
      : formatted;

    // Update description for short prompts
    if (prompt.length < 100 && subtask.description) {
      const date = new Date().toLocaleDateString();
      subtask.description += ` [Updated: ${date}]`;
    }

    return {
      task: parentTask,
      newlyAddedSnippet: formatted
    };
  }
}
```

```typescript
// packages/tm-core/src/modules/ai/services/ai-service.ts

/**
 * Wrapper around AI provider functionality
 * Abstracts generateObject and generateText from scripts/
 */
export class AIService {
  constructor(
    private configManager: ConfigManager,
    private logger: Logger
  ) {}

  /**
   * Generate structured output using schema
   */
  async generateObject(params: {
    systemPrompt: string;
    userPrompt: string;
    schema: ZodSchema;
    role: 'main' | 'research' | 'fallback';
    session?: any;
    projectRoot?: string;
  }): Promise<{
    tasks: Task[];
    telemetry: TelemetryData;
    tagInfo?: TagInfo;
  }> {
    // Delegates to generateObjectService from scripts/
    // Eventually this will be fully implemented in tm-core
  }

  /**
   * Generate freeform text
   */
  async generateText(params: {
    systemPrompt: string;
    userPrompt: string;
    role: 'main' | 'research' | 'fallback';
    session?: any;
    projectRoot?: string;
  }): Promise<{
    text: string;
    telemetry: TelemetryData;
  }> {
    // Delegates to generateTextService from scripts/
  }
}
```

---

## File Structure

```
packages/tm-core/src/modules/tasks/
├── tasks-domain.ts                                    # Public API
├── services/
│   ├── task-update.service.ts                         # Application orchestrator
│   ├── task-merger.service.ts                         # Result merging logic
│   ├── task-service.ts                                # Existing
│   ├── task-execution-service.ts                      # Existing
│   └── task-loader.service.ts                         # Existing
├── strategies/
│   ├── task-update-strategy.interface.ts              # Strategy contract
│   ├── local-task-update.strategy.ts                  # File storage strategy
│   └── remote-task-update.strategy.ts                 # API storage strategy
├── factories/
│   └── task-update-strategy.factory.ts                # Creates strategies
├── utils/
│   ├── context-gatherer.ts                            # Moved from scripts/
│   └── fuzzy-task-search.ts                           # Moved from scripts/
└── repositories/                                       # Existing

packages/tm-core/src/modules/ai/
├── services/
│   ├── ai-service.ts                                  # AI operations wrapper
│   └── prompt-builder.service.ts                      # Prompt construction
├── providers/
│   └── base-provider.ts                               # Existing
└── interfaces/
    └── ai-provider.interface.ts                       # Existing

apps/cli/src/commands/
├── update.command.ts                                  # CLI for bulk update
├── update-task.command.ts                             # CLI for single update
└── update-subtask.command.ts                          # CLI for subtask update

apps/mcp/src/tools/
├── update.tool.ts                                     # MCP tool for bulk
├── update-task.tool.ts                                # MCP tool for single
└── update-subtask.tool.ts                             # MCP tool for subtask
```

---

## Implementation Phases

### Phase 1: Infrastructure Services
**Goal**: Move and adapt utilities from scripts/ to tm-core

1. **Context gathering utilities**
   - [ ] Move `scripts/modules/utils/contextGatherer.js` → `packages/tm-core/src/modules/tasks/utils/context-gatherer.ts`
   - [ ] Move `scripts/modules/utils/fuzzyTaskSearch.js` → `packages/tm-core/src/modules/tasks/utils/fuzzy-task-search.ts`
   - [ ] Convert to TypeScript with proper types
   - [ ] Add unit tests

2. **Prompt building service**
   - [ ] Move `scripts/modules/prompt-manager.js` → `packages/tm-core/src/modules/ai/services/prompt-builder.service.ts`
   - [ ] Wrap PromptManager functionality
   - [ ] Add TypeScript types
   - [ ] Add unit tests

3. **AI service wrapper**
   - [ ] Create `packages/tm-core/src/modules/ai/services/ai-service.ts`
   - [ ] Wrap `generateObjectService` and `generateTextService`
   - [ ] Temporarily delegate to scripts/ versions
   - [ ] Add unit tests

4. **Task merger service**
   - [ ] Create `packages/tm-core/src/modules/tasks/services/task-merger.service.ts`
   - [ ] Implement `mergeBulkUpdate()`
   - [ ] Implement `mergeSingleUpdate()`
   - [ ] Implement `mergeSubtaskUpdate()`
   - [ ] Add comprehensive unit tests

### Phase 2: Strategy Pattern
**Goal**: Implement the strategy layer

1. **Strategy interface**
   - [ ] Create `packages/tm-core/src/modules/tasks/strategies/task-update-strategy.interface.ts`
   - [ ] Define `ITaskUpdateStrategy` interface
   - [ ] Define `UpdateOptions` and `UpdateResult` types

2. **Local strategy (file storage)**
   - [ ] Create `packages/tm-core/src/modules/tasks/strategies/local-task-update.strategy.ts`
   - [ ] Implement `updateBulk()` - full AI workflow
   - [ ] Implement `updateSingle()` - single task AI workflow
   - [ ] Implement `updateSubtask()` - subtask append workflow
   - [ ] Add unit tests with mocked dependencies

3. **Remote strategy (API storage)**
   - [ ] Create `packages/tm-core/src/modules/tasks/strategies/remote-task-update.strategy.ts`
   - [ ] Implement `updateBulk()` - API delegation
   - [ ] Implement `updateSingle()` - API delegation
   - [ ] Implement `updateSubtask()` - API delegation
   - [ ] Add unit tests with mocked API client

4. **Strategy factory**
   - [ ] Create `packages/tm-core/src/modules/tasks/factories/task-update-strategy.factory.ts`
   - [ ] Implement `create()` method with storage type detection
   - [ ] Add unit tests for factory logic

### Phase 3: Application Layer
**Goal**: Wire up the orchestration layer

1. **Task update service**
   - [ ] Create `packages/tm-core/src/modules/tasks/services/task-update.service.ts`
   - [ ] Inject strategy via factory
   - [ ] Delegate all operations to strategy
   - [ ] Add integration tests

2. **Tasks domain**
   - [ ] Add `updateBulk()` to `tasks-domain.ts`
   - [ ] Add `updateSingle()` to `tasks-domain.ts`
   - [ ] Add `updateSubtask()` to `tasks-domain.ts`
   - [ ] Update exports in module index

### Phase 4: Presentation Layer
**Goal**: Create CLI and MCP interfaces

1. **CLI commands**
   - [ ] Create `apps/cli/src/commands/update.command.ts`
   - [ ] Create `apps/cli/src/commands/update-task.command.ts`
   - [ ] Create `apps/cli/src/commands/update-subtask.command.ts`
   - [ ] Add CLI-specific UI (tables, loading, etc.)

2. **MCP tools**
   - [ ] Create `apps/mcp/src/tools/update.tool.ts`
   - [ ] Create `apps/mcp/src/tools/update-task.tool.ts`
   - [ ] Create `apps/mcp/src/tools/update-subtask.tool.ts`
   - [ ] Add MCP-specific response formatting

### Phase 5: Testing & Verification
**Goal**: Ensure everything works correctly

1. **Integration tests**
   - [ ] Test file storage workflow end-to-end
   - [ ] Test API storage workflow end-to-end
   - [ ] Test strategy switching
   - [ ] Test error scenarios

2. **Manual testing**
   - [ ] Test CLI with file storage
   - [ ] Test CLI with API storage (when available)
   - [ ] Test MCP tools
   - [ ] Verify telemetry data

---

## Benefits of This Architecture

### 1. **Single Responsibility Principle**
- Each class has exactly one reason to change
- TaskUpdateService: Orchestration
- LocalTaskUpdateStrategy: File storage workflow
- RemoteTaskUpdateStrategy: API storage workflow
- TaskMergerService: Result merging logic

### 2. **Open/Closed Principle**
- Open for extension (add new strategies)
- Closed for modification (existing code unchanged)
- Example: Add `HybridTaskUpdateStrategy` without touching existing code

### 3. **Dependency Inversion**
- High-level modules depend on abstractions (ITaskUpdateStrategy)
- Low-level modules implement abstractions
- Easy to swap implementations

### 4. **Strategy Pattern Benefits**
- Encapsulates different algorithms (workflows)
- Makes algorithms interchangeable
- Eliminates conditional statements
- Easier to test in isolation

### 5. **Clean Separation of Concerns**
- Storage concerns ≠ AI concerns ≠ Orchestration concerns
- File I/O isolated to LocalStrategy
- HTTP calls isolated to RemoteStrategy
- AI logic isolated to AIService

### 6. **Testability**
- Each layer can be tested independently
- Easy to mock dependencies
- Strategy pattern enables isolated testing
- Clear boundaries for unit vs integration tests

### 7. **Future-Proof**
- Easy to add new storage types (e.g., `LocalDbTaskUpdateStrategy`)
- Easy to add new update modes (e.g., `StreamingUpdateStrategy`)
- Easy to add new AI providers
- Maintainable and scalable

---

## Usage Examples

### File Storage (Local AI)

```typescript
// User calls via CLI
await tmCore.tasks.updateBulk(5, "Add error handling to all API calls");

// Flow:
// 1. TasksDomain.updateBulk()
// 2. TaskUpdateService.updateBulk()
// 3. LocalTaskUpdateStrategy.updateBulk()
//    a. Load tasks from file
//    b. Filter tasks (id >= 5, status !== 'done')
//    c. ContextGatherer.gather() - Find relevant context
//    d. PromptBuilder.build() - Build AI prompts
//    e. AIService.generateObject() - Call AI
//    f. TaskMerger.mergeBulkUpdate() - Merge results
//    g. Storage.saveTasks() - Write to file
// 4. Return UpdateResult
```

### API Storage (Remote AI)

```typescript
// User calls via CLI
await tmCore.tasks.updateBulk(5, "Add error handling to all API calls");

// Flow:
// 1. TasksDomain.updateBulk()
// 2. TaskUpdateService.updateBulk()
// 3. RemoteTaskUpdateStrategy.updateBulk()
//    a. ApiClient.post('/projects/123/tasks/bulk-update', {...})
//    b. Server handles everything
// 4. Return UpdateResult from API
```

---

## Key Takeaways

1. **Storage type detection happens ONCE** - in the factory
2. **No if/else branching** in application layer - strategy pattern handles it
3. **AI utilities only exist in LocalStrategy** - RemoteStrategy doesn't need them
4. **Each layer has clear boundaries** - Domain → Application → Strategy → Infrastructure
5. **Easy to test** - Mock strategies, services, and dependencies independently
6. **Future-proof** - Add new strategies without modifying existing code

---
