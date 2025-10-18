# Update Task Migration Plan

## Overview

Migrate and unify `update-tasks.js` and `update-subtask-by-id.js` into a single `update-task` command that handles both task and subtask updates. This migration will move from the legacy `scripts/modules/task-manager/` structure to the new `apps/cli` and `packages/tm-core` architecture.

## Current State Analysis

### `update-tasks.js` - Bulk Task Updates

**Purpose**: Update multiple tasks from a specified ID onwards
**Input Format**: `--from=<id> --prompt="context"`
**AI Service**: `generateObjectService` with structured schema

### `update-subtask-by-id.js` - Single Subtask Updates

**Purpose**: Append timestamped information to a specific subtask
**Input Format**: `--id=<parentId.subtaskId> --prompt="notes"`
**AI Service**: `generateTextService` for freeform content

## Unified Command Design

### New Command: `update-task`

```bash
# Update single task (replaces update-task)
task-master update-task --id=3 --prompt="changes"

# Update single subtask (replaces update-subtask)
task-master update-task --id=3.2 --prompt="implementation notes"

# Update multiple tasks from ID onwards (replaces update --from)
task-master update-task --from=3 --prompt="changes"
```

### Intelligent Behavior Detection

The command should automatically determine behavior based on:

1. **ID format**: Contains `.` → subtask mode
2. **--from flag**: Present → bulk update mode
3. **Default**: Single task update mode

---

## Functionality Checklist

### Core Functionality

#### Input Validation & Parsing

- [ ] Validate `tasksPath` exists
- [ ] Validate `id` parameter (task: integer, subtask: "parent.child" format)
- [ ] Validate `fromId` parameter (integer, positive)
- [ ] Validate `prompt` parameter (non-empty string)
- [ ] Parse subtask ID format: split "parentId.subtaskId" and validate both parts
- [ ] Determine project root (from context or `findProjectRoot()`)
- [ ] Support both MCP and CLI modes (detect via `mcpLog` presence)
- [ ] Handle `outputFormat` ('text' or 'json', auto-detect for MCP)

#### Task Loading & Filtering

- [ ] Load tasks from `tasks.json` using `readJSON(tasksPath, projectRoot, tag)`
- [ ] Validate tasks data structure exists
- [ ] **Bulk mode**: Filter tasks where `id >= fromId AND status !== 'done'`
- [ ] **Single task mode**: Find specific task by ID
- [ ] **Subtask mode**: Find parent task, validate subtasks array, find specific subtask
- [ ] Handle "no tasks to update" scenario gracefully

#### Context Gathering

- [ ] Initialize `ContextGatherer` with projectRoot and tag
- [ ] Flatten all tasks with subtasks using `flattenTasksWithSubtasks()`
- [ ] Initialize `FuzzyTaskSearch` with appropriate command type:
  - `'update'` for bulk/single task mode
  - `'update-subtask'` for subtask mode
- [ ] **Bulk/Single task**: Search with prompt, max 5 results, include self
- [ ] **Subtask mode**: Search with combined query: `${parentTask.title} ${subtask.title} ${prompt}`
- [ ] Merge task IDs to update with relevant context task IDs
- [ ] Gather context in 'research' format
- [ ] Handle context gathering errors gracefully (log warning, continue)

#### Prompt Building

- [ ] Initialize `PromptManager` via `getPromptManager()`
- [ ] **Bulk/Single task mode**: Load 'update-tasks' prompt template with params:
  - `tasks` (array of tasks to update)
  - `updatePrompt`
  - `useResearch`
  - `projectContext` (gathered context)
  - `hasCodebaseAnalysis` (from config)
  - `projectRoot`
- [ ] **Subtask mode**: Load 'update-subtask' prompt template with params:
  - `parentTask` (id, title)
  - `prevSubtask` (id, title, status) - if exists
  - `nextSubtask` (id, title, status) - if exists
  - `currentDetails` (existing subtask details or fallback)
  - `updatePrompt`
  - `useResearch`
  - `gatheredContext`
  - `hasCodebaseAnalysis`
  - `projectRoot`
- [ ] **Subtask mode**: Support variant key ('research' or 'default')
- [ ] Extract `systemPrompt` and `userPrompt` from prompt manager

#### AI Service Integration

- [ ] Determine service role: `useResearch ? 'research' : 'main'`
- [ ] **Bulk/Single task mode**: Call `generateObjectService` with:
  - `role`, `session`, `projectRoot`
  - `systemPrompt`, `prompt` (userPrompt)
  - `schema: COMMAND_SCHEMAS['update-tasks']`
  - `objectName: 'tasks'`
  - `commandName: 'update-tasks'`
  - `outputType: isMCP ? 'mcp' : 'cli'`
- [ ] **Subtask mode**: Call `generateTextService` with:
  - `prompt` (userPrompt), `systemPrompt`
  - `role`, `session`, `projectRoot`
  - `maxRetries: 2`
  - `commandName: 'update-subtask'`
  - `outputType: isMCP ? 'mcp' : 'cli'`
- [ ] Handle empty/invalid AI responses
- [ ] Capture `telemetryData` and `tagInfo` from response

#### Data Updates & Persistence

- [ ] **Bulk/Single task mode**:
  - Parse `aiServiceResponse.mainResult.tasks` array
  - Validate array structure
  - Create Map for efficient lookup
  - Merge updated tasks with existing, preserving subtasks field
  - Track actual update count
- [ ] **Subtask mode**:
  - Extract text string from `aiServiceResponse.mainResult`
  - Generate ISO timestamp
  - Format as: `<info added on ${timestamp}>\n${content}\n</info added on ${timestamp}>`
  - Append to `subtask.details` (create if doesn't exist)
  - Store newly added snippet separately for display
  - If prompt < 100 chars: append `[Updated: ${date}]` to subtask.description
- [ ] Write updated data using `writeJSON(tasksPath, data, projectRoot, tag)`
- [ ] Optionally call `generateTaskFiles()` (currently commented out in both)

#### CLI Display & UX

- [ ] **Pre-update display** (CLI only, text mode):
  - Create table with columns: ID, Title, Status
  - Truncate titles appropriately (57 chars for tasks, 52 for subtasks)
  - Apply status colors via `getStatusWithColor()`
  - Show boxed header with update count/target
  - **Bulk mode**: Show info box about completed subtasks handling
  - Display table
- [ ] **Loading indicators** (CLI only, text mode):
  - Start loading indicator before AI call
  - Message: "Updating tasks with AI..." (bulk/single) or "Updating subtask..." (subtask)
  - Support research variant message
  - Stop indicator when complete or on error
- [ ] **Post-update display** (CLI only, text mode):
  - **Bulk/Single task**: Success message with update count
  - **Subtask mode**: Boxed success message with:
    - Subtask ID
    - Title
    - "Newly Added Snippet" section showing timestamped content
  - Display AI usage summary via `displayAiUsageSummary(telemetryData, 'cli')`

#### Logging & Debugging

- [ ] Use appropriate logger: `mcpLog` (MCP) or `consoleLog` (CLI)
- [ ] Log info messages with proper format (MCP vs CLI differences)
- [ ] Log start of operation with key parameters
- [ ] Log task counts and AI response details
- [ ] Log successful completion
- [ ] **Debug mode** (when `getDebugFlag(session)` true):
  - Log subtask details before/after update
  - Log writeJSON calls
  - Log full error stack traces

#### Error Handling

- [ ] Catch and handle errors at multiple levels:
  - Context gathering errors (warn and continue)
  - AI service errors (stop and report)
  - General operation errors (report and exit/throw)
- [ ] **CLI mode**:
  - Print colored error messages
  - Show helpful troubleshooting for common errors:
    - API key missing/invalid
    - Model overloaded
    - Task/subtask not found
    - Invalid ID format
    - Empty prompt
    - Empty AI response
  - Exit with code 1
- [ ] **MCP mode**: Re-throw errors for caller handling
- [ ] Always stop loading indicators on error

#### Return Values

- [ ] **Success returns** (both modes):

  ```javascript
  {
    success: true,  // bulk/single task only
    updatedTasks: [...],  // bulk/single task only
    updatedSubtask: {...},  // subtask only
    telemetryData: {...},
    tagInfo: {...}
  }
  ```

- [ ] **Failure returns**:
  - CLI: exits with code 1
  - MCP: throws error
  - Subtask mode: returns `null` on error

### Special Features

#### Completed Subtasks Handling (Bulk Mode)

- [ ] Display informational box explaining:
  - Done/completed subtasks are preserved
  - New subtasks build upon completed work
  - Revisions create new subtasks instead of modifying done items
  - Maintains clear record of progress

#### Subtask Context Awareness

- [ ] Provide parent task context (id, title) to AI
- [ ] Provide previous subtask context (if exists) to AI
- [ ] Provide next subtask context (if exists) to AI
- [ ] Include current subtask details in prompt

#### Timestamp Tracking

- [ ] Use ISO format timestamps for subtask updates
- [ ] Wrap appended content in timestamped tags
- [ ] Update description field with simple date stamp (short prompts only)

---

## Migration Architecture

### Object-Oriented Design Philosophy

This migration will follow the established patterns in `tm-core` and `apps/cli`:
- **Domain separation** with clear bounded contexts
- **Dependency injection** for testability and flexibility
- **Abstract base classes** for shared behavior
- **Interfaces** for contracts and loose coupling
- **Service layer** for business logic orchestration
- **Factory pattern** for object creation
- **Single Responsibility Principle** throughout

### Package Structure

```
packages/tm-core/
  src/
    commands/
      update-task/
        # Core Interfaces & Types
        types.ts                              # Shared types, enums, interfaces
        interfaces/
          update-strategy.interface.ts        # IUpdateStrategy contract
          update-context.interface.ts         # IUpdateContext contract
          display.interface.ts                # IDisplayManager contract

        # Services (Business Logic)
        update-task.service.ts                # Main orchestrator service
        context-builder.service.ts            # Builds AI context (uses ContextGatherer, FuzzySearch)
        prompt-builder.service.ts             # Builds prompts (uses PromptManager)
        data-merger.service.ts                # Merges AI results with existing data

        # Strategies (Update Mode Logic)
        strategies/
          base-update.strategy.ts             # Abstract base class for all strategies
          bulk-update.strategy.ts             # Bulk task update implementation
          single-task-update.strategy.ts      # Single task update implementation
          subtask-update.strategy.ts          # Subtask update implementation

        # Utilities & Helpers
        validators/
          update-input.validator.ts           # Validates all input parameters
          task-id.validator.ts                # Parses and validates task/subtask IDs

        display/
          cli-display.manager.ts              # CLI output formatting
          json-display.manager.ts             # JSON output formatting
          update-display.factory.ts           # Creates appropriate display manager

        factories/
          update-strategy.factory.ts          # Creates appropriate strategy based on mode

        # Main Entry Point
        index.ts                              # Public API export

apps/cli/
  src/
    commands/
      update-task.command.ts                  # CLI command definition (uses UpdateTaskService)
```

### Core Classes & Their Responsibilities

#### 1. **UpdateTaskService** (Main Orchestrator)
```typescript
/**
 * Main service that coordinates the entire update process
 * Handles initialization, strategy selection, and result aggregation
 */
export class UpdateTaskService {
  constructor(
    private readonly configManager: ConfigManager,
    private readonly storage: IStorage,
    private readonly logger: Logger,
    private readonly strategyFactory: UpdateStrategyFactory,
    private readonly contextBuilder: ContextBuilderService,
    private readonly displayFactory: UpdateDisplayFactory
  ) {}

  async updateTask(options: UpdateTaskOptions): Promise<UpdateTaskResult> {
    // 1. Validate inputs
    // 2. Detect mode and create strategy
    // 3. Build context
    // 4. Execute strategy
    // 5. Display results
    // 6. Return result
  }
}
```

**Uses (existing classes):**
- `ConfigManager` - Project configuration
- `IStorage` - Task persistence
- `Logger` - Logging
- `ContextGatherer` - Gather related context
- `FuzzyTaskSearch` - Find relevant tasks
- `PromptManager` - Load prompt templates

**Uses (new classes):**
- `UpdateStrategyFactory` - Create update strategy
- `ContextBuilderService` - Build AI context
- `UpdateDisplayFactory` - Create display manager

---

#### 2. **IUpdateStrategy** (Strategy Interface)
```typescript
/**
 * Contract for all update strategies
 * Defines the common interface for bulk, single, and subtask updates
 */
export interface IUpdateStrategy {
  /**
   * Validate that the strategy can handle the given context
   */
  validate(context: IUpdateContext): Promise<void>;

  /**
   * Load and filter tasks that need updating
   */
  loadTasks(context: IUpdateContext): Promise<TaskLoadResult>;

  /**
   * Build prompts for AI service
   */
  buildPrompts(
    context: IUpdateContext,
    tasks: TaskLoadResult
  ): Promise<PromptResult>;

  /**
   * Call appropriate AI service
   */
  callAIService(
    context: IUpdateContext,
    prompts: PromptResult
  ): Promise<AIServiceResult>;

  /**
   * Merge AI results with existing data
   */
  mergeResults(
    context: IUpdateContext,
    aiResult: AIServiceResult,
    originalTasks: TaskLoadResult
  ): Promise<MergeResult>;

  /**
   * Get the mode this strategy handles
   */
  getMode(): UpdateMode;
}
```

---

#### 3. **BaseUpdateStrategy** (Abstract Base Class)
```typescript
/**
 * Provides common functionality for all update strategies
 * Implements template method pattern for the update workflow
 */
export abstract class BaseUpdateStrategy implements IUpdateStrategy {
  protected readonly logger: Logger;

  constructor(
    protected readonly contextBuilder: ContextBuilderService,
    protected readonly promptBuilder: PromptBuilderService,
    protected readonly dataMerger: DataMergerService,
    protected readonly aiService: AIService // wrapper around generate[Object|Text]Service
  ) {
    this.logger = getLogger(`UpdateStrategy:${this.getMode()}`);
  }

  // Template method - defines the workflow
  async execute(context: IUpdateContext): Promise<UpdateStrategyResult> {
    await this.validate(context);
    const tasks = await this.loadTasks(context);
    const prompts = await this.buildPrompts(context, tasks);
    const aiResult = await this.callAIService(context, prompts);
    const merged = await this.mergeResults(context, aiResult, tasks);
    return merged;
  }

  // Subclasses must implement these
  abstract validate(context: IUpdateContext): Promise<void>;
  abstract loadTasks(context: IUpdateContext): Promise<TaskLoadResult>;
  abstract getMode(): UpdateMode;

  // Shared implementations with extensibility
  async buildPrompts(
    context: IUpdateContext,
    tasks: TaskLoadResult
  ): Promise<PromptResult> {
    // Delegates to PromptBuilderService with mode-specific params
  }

  protected abstract getPromptParams(
    context: IUpdateContext,
    tasks: TaskLoadResult
  ): PromptParams;
}
```

---

#### 4. **BulkUpdateStrategy** (Concrete Strategy)
```typescript
/**
 * Handles bulk task updates (--from flag)
 * Uses generateObjectService for structured updates
 */
export class BulkUpdateStrategy extends BaseUpdateStrategy {
  getMode(): UpdateMode {
    return UpdateMode.BULK;
  }

  async validate(context: IUpdateContext): Promise<void> {
    if (!context.options.from) {
      throw new TaskMasterError('Bulk mode requires --from parameter');
    }
    // Additional validations...
  }

  async loadTasks(context: IUpdateContext): Promise<TaskLoadResult> {
    // Filter tasks where id >= fromId AND status !== 'done'
  }

  async callAIService(
    context: IUpdateContext,
    prompts: PromptResult
  ): Promise<AIServiceResult> {
    // Call generateObjectService with update-tasks schema
  }

  protected getPromptParams(
    context: IUpdateContext,
    tasks: TaskLoadResult
  ): PromptParams {
    return {
      tasks: tasks.tasks,
      updatePrompt: context.options.prompt,
      useResearch: context.options.useResearch,
      projectContext: tasks.gatheredContext,
      // ...
    };
  }
}
```

---

#### 5. **SubtaskUpdateStrategy** (Concrete Strategy)
```typescript
/**
 * Handles single subtask updates (--id with dot notation)
 * Uses generateTextService for timestamped appends
 */
export class SubtaskUpdateStrategy extends BaseUpdateStrategy {
  getMode(): UpdateMode {
    return UpdateMode.SUBTASK;
  }

  async validate(context: IUpdateContext): Promise<void> {
    const parsed = TaskIdValidator.parseSubtaskId(context.options.id);
    if (!parsed) {
      throw new TaskMasterError('Invalid subtask ID format');
    }
  }

  async loadTasks(context: IUpdateContext): Promise<TaskLoadResult> {
    // Find parent task, locate specific subtask
    // Build context with prev/next subtask info
  }

  async callAIService(
    context: IUpdateContext,
    prompts: PromptResult
  ): Promise<AIServiceResult> {
    // Call generateTextService for freeform content
  }

  async mergeResults(
    context: IUpdateContext,
    aiResult: AIServiceResult,
    originalTasks: TaskLoadResult
  ): Promise<MergeResult> {
    // Append timestamped content to subtask.details
    const timestamp = new Date().toISOString();
    const formatted = `<info added on ${timestamp}>\n${aiResult.text}\n</info>`;
    // ...
  }
}
```

---

#### 6. **SingleTaskUpdateStrategy** (Concrete Strategy)
```typescript
/**
 * Handles single task updates (--id without dot)
 * Uses generateObjectService for structured updates
 */
export class SingleTaskUpdateStrategy extends BaseUpdateStrategy {
  getMode(): UpdateMode {
    return UpdateMode.SINGLE;
  }

  async validate(context: IUpdateContext): Promise<void> {
    TaskIdValidator.validateTaskId(context.options.id);
  }

  async loadTasks(context: IUpdateContext): Promise<TaskLoadResult> {
    // Find single task by ID
  }

  // Similar to BulkUpdateStrategy but operates on single task
}
```

---

#### 7. **ContextBuilderService** (Helper Service)
```typescript
/**
 * Builds context for AI prompts
 * Coordinates ContextGatherer and FuzzyTaskSearch
 */
export class ContextBuilderService {
  constructor(
    private readonly logger: Logger
  ) {}

  async buildContext(
    options: ContextBuildOptions
  ): Promise<BuiltContext> {
    try {
      const gatherer = new ContextGatherer(
        options.projectRoot,
        options.tag
      );

      const allTasksFlat = flattenTasksWithSubtasks(options.allTasks);
      const fuzzySearch = new FuzzyTaskSearch(
        allTasksFlat,
        options.searchMode // 'update' or 'update-subtask'
      );

      const searchResults = fuzzySearch.findRelevantTasks(
        options.searchQuery,
        { maxResults: 5, includeSelf: true }
      );

      const relevantTaskIds = fuzzySearch.getTaskIds(searchResults);
      const finalTaskIds = [
        ...new Set([...options.targetTaskIds, ...relevantTaskIds])
      ];

      const contextResult = await gatherer.gather({
        tasks: finalTaskIds,
        format: 'research'
      });

      return {
        context: contextResult.context || '',
        taskIds: finalTaskIds
      };
    } catch (error) {
      this.logger.warn(`Context gathering failed: ${error.message}`);
      return { context: '', taskIds: options.targetTaskIds };
    }
  }
}
```

**Uses (existing):**
- `ContextGatherer`
- `FuzzyTaskSearch`

---

#### 8. **PromptBuilderService** (Helper Service)
```typescript
/**
 * Builds system and user prompts for AI services
 * Wraps PromptManager with strategy-specific logic
 */
export class PromptBuilderService {
  constructor(
    private readonly promptManager: PromptManager,
    private readonly logger: Logger
  ) {}

  async buildPrompt(
    templateName: string,
    params: PromptParams,
    variant?: string
  ): Promise<PromptResult> {
    const { systemPrompt, userPrompt } = await this.promptManager.loadPrompt(
      templateName,
      params,
      variant
    );

    return {
      systemPrompt,
      userPrompt,
      templateName,
      params
    };
  }
}
```

**Uses (existing):**
- `PromptManager`

---

#### 9. **DataMergerService** (Helper Service)
```typescript
/**
 * Merges AI service results with existing task data
 * Handles different merge strategies for different modes
 */
export class DataMergerService {
  constructor(private readonly logger: Logger) {}

  /**
   * Merge for bulk/single task mode (structured updates)
   */
  mergeTasks(
    existingTasks: Task[],
    updatedTasks: Task[],
    options: MergeOptions
  ): MergeResult {
    const updatedTasksMap = new Map(
      updatedTasks.map(t => [t.id, t])
    );

    let updateCount = 0;
    const merged = existingTasks.map(task => {
      if (updatedTasksMap.has(task.id)) {
        const updated = updatedTasksMap.get(task.id)!;
        updateCount++;
        return {
          ...task,
          ...updated,
          // Preserve subtasks if not provided by AI
          subtasks: updated.subtasks !== undefined
            ? updated.subtasks
            : task.subtasks
        };
      }
      return task;
    });

    return {
      tasks: merged,
      updateCount,
      mode: 'structured'
    };
  }

  /**
   * Merge for subtask mode (timestamped append)
   */
  mergeSubtask(
    parentTask: Task,
    subtaskIndex: number,
    newContent: string,
    options: SubtaskMergeOptions
  ): SubtaskMergeResult {
    const subtask = parentTask.subtasks![subtaskIndex];
    const timestamp = new Date().toISOString();
    const formatted = `<info added on ${timestamp}>\n${newContent.trim()}\n</info added on ${timestamp}>`;

    subtask.details = (subtask.details ? subtask.details + '\n' : '') + formatted;

    // Short prompts get description timestamp
    if (options.prompt.length < 100 && subtask.description) {
      subtask.description += ` [Updated: ${new Date().toLocaleDateString()}]`;
    }

    return {
      updatedSubtask: subtask,
      newlyAddedSnippet: formatted,
      parentTask
    };
  }
}
```

---

#### 10. **IDisplayManager** (Display Interface)
```typescript
/**
 * Contract for display managers
 * Allows different output formats (CLI, JSON, etc.)
 */
export interface IDisplayManager {
  /**
   * Show tasks before update
   */
  showPreUpdate(tasks: Task[], mode: UpdateMode): void;

  /**
   * Show loading indicator
   */
  startLoading(message: string): void;
  stopLoading(success?: boolean): void;

  /**
   * Show post-update results
   */
  showPostUpdate(result: UpdateStrategyResult, mode: UpdateMode): void;

  /**
   * Show telemetry/usage data
   */
  showTelemetry(telemetry: TelemetryData): void;

  /**
   * Show errors
   */
  showError(error: Error): void;
}
```

---

#### 11. **CLIDisplayManager** (Concrete Display)
```typescript
/**
 * Formats output for CLI with colors, tables, and boxes
 */
export class CLIDisplayManager implements IDisplayManager {
  constructor(
    private readonly logger: Logger,
    private readonly isSilent: boolean
  ) {}

  showPreUpdate(tasks: Task[], mode: UpdateMode): void {
    // Create table with ID, Title, Status columns
    // Show boxed header
    // For bulk mode: show completed subtasks info box
  }

  startLoading(message: string): void {
    // startLoadingIndicator(message)
  }

  // ... implement other methods with chalk, boxen, cli-table3
}
```

---

#### 12. **UpdateStrategyFactory** (Factory)
```typescript
/**
 * Creates the appropriate update strategy based on mode
 */
export class UpdateStrategyFactory {
  constructor(
    private readonly contextBuilder: ContextBuilderService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly dataMerger: DataMergerService,
    private readonly aiService: AIService
  ) {}

  createStrategy(mode: UpdateMode): IUpdateStrategy {
    switch (mode) {
      case UpdateMode.BULK:
        return new BulkUpdateStrategy(
          this.contextBuilder,
          this.promptBuilder,
          this.dataMerger,
          this.aiService
        );
      case UpdateMode.SINGLE:
        return new SingleTaskUpdateStrategy(
          this.contextBuilder,
          this.promptBuilder,
          this.dataMerger,
          this.aiService
        );
      case UpdateMode.SUBTASK:
        return new SubtaskUpdateStrategy(
          this.contextBuilder,
          this.promptBuilder,
          this.dataMerger,
          this.aiService
        );
      default:
        throw new TaskMasterError(`Unknown update mode: ${mode}`);
    }
  }

  detectMode(options: UpdateTaskOptions): UpdateMode {
    if (options.from !== undefined) {
      return UpdateMode.BULK;
    }
    if (options.id && typeof options.id === 'string' && options.id.includes('.')) {
      return UpdateMode.SUBTASK;
    }
    if (options.id !== undefined) {
      return UpdateMode.SINGLE;
    }
    throw new TaskMasterError('Must provide either --id or --from parameter');
  }
}
```

---

#### 13. **Validators** (Utility Classes)
```typescript
/**
 * Validates all update task inputs
 */
export class UpdateInputValidator {
  static validate(options: UpdateTaskOptions): void {
    // Validate tasksPath, prompt, etc.
  }
}

/**
 * Parses and validates task/subtask IDs
 */
export class TaskIdValidator {
  static validateTaskId(id: any): number {
    // Parse and validate task ID
  }

  static parseSubtaskId(id: string): SubtaskIdParts | null {
    // Parse "parentId.subtaskId" format
  }
}
```

---

### Class Diagram (Relationships)

```
┌─────────────────────────┐
│  UpdateTaskService      │ ◄─── Main Orchestrator
│  (Coordinates)          │
└───────┬─────────────────┘
        │ uses
        ├──► UpdateStrategyFactory ──creates──► IUpdateStrategy
        │                                           │
        ├──► ContextBuilderService                 │ implements
        │                                           ▼
        ├──► IDisplayManager ◄──creates── UpdateDisplayFactory
        │         │
        │         ├── CLIDisplayManager
        │         └── JSONDisplayManager
        │
        └──► ConfigManager (existing)
             IStorage (existing)
             Logger (existing)

┌────────────────────────────────────────────────────┐
│                 IUpdateStrategy                    │
└────────────────────────────────────────────────────┘
                        △
                        │ extends
            ┌───────────┴────────────┐
            │                        │
┌───────────────────────┐    ┌──────────────────────┐
│  BaseUpdateStrategy   │    │  Abstract base with  │
│  (Template Method)    │    │  common workflow     │
└───────────┬───────────┘    └──────────────────────┘
            │ extends
    ┌───────┼──────────┬─────────────┐
    │       │          │             │
┌───▼───┐ ┌─▼────┐  ┌─▼──────────┐  │
│ Bulk  │ │Single│  │  Subtask   │  │
│Update │ │Task  │  │  Update    │  │
│       │ │Update│  │            │  │
└───────┘ └──────┘  └────────────┘  │
                                     │
                                     ├──► ContextBuilderService
                                     │      ├─uses─► ContextGatherer (existing)
                                     │      └─uses─► FuzzyTaskSearch (existing)
                                     │
                                     ├──► PromptBuilderService
                                     │      └─uses─► PromptManager (existing)
                                     │
                                     └──► DataMergerService
```

---

### Dependency Injection & Initialization

```typescript
// In packages/tm-core/src/commands/update-task/index.ts

/**
 * Factory function to create a fully initialized UpdateTaskService
 */
export async function createUpdateTaskService(
  configManager: ConfigManager,
  storage: IStorage
): Promise<UpdateTaskService> {
  const logger = getLogger('UpdateTaskService');

  // Create helper services
  const contextBuilder = new ContextBuilderService(logger);
  const promptManager = getPromptManager(); // existing
  const promptBuilder = new PromptBuilderService(promptManager, logger);
  const dataMerger = new DataMergerService(logger);
  const aiService = new AIService(); // wrapper around generateObjectService/generateTextService

  // Create factory
  const strategyFactory = new UpdateStrategyFactory(
    contextBuilder,
    promptBuilder,
    dataMerger,
    aiService
  );

  // Create display factory
  const displayFactory = new UpdateDisplayFactory();

  // Create service
  return new UpdateTaskService(
    configManager,
    storage,
    logger,
    strategyFactory,
    contextBuilder,
    displayFactory
  );
}
```

---

### Types & Interfaces

```typescript
// packages/tm-core/src/commands/update-task/types.ts

export enum UpdateMode {
  BULK = 'bulk',
  SINGLE = 'single',
  SUBTASK = 'subtask'
}

export interface UpdateTaskOptions {
  tasksPath: string;
  id?: number | string;
  from?: number;
  prompt: string;
  useResearch?: boolean;
  context?: UpdateContext;
  outputFormat?: 'text' | 'json';
}

export interface UpdateContext {
  session?: any;
  mcpLog?: any;
  projectRoot?: string;
  tag?: string;
}

export interface UpdateTaskResult {
  success: boolean;
  mode: UpdateMode;
  updatedTasks?: Task[];
  updatedSubtask?: Subtask;
  updateCount?: number;
  telemetryData?: TelemetryData;
  tagInfo?: TagInfo;
}

export interface IUpdateContext {
  options: UpdateTaskOptions;
  projectRoot: string;
  tag?: string;
  mode: UpdateMode;
  isMCP: boolean;
  logger: Logger;
}

export interface TaskLoadResult {
  tasks: Task[];
  gatheredContext: string;
  originalData: TasksData;
}

export interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
  templateName: string;
  params: PromptParams;
}

export interface AIServiceResult {
  mainResult: any; // structured object or text string
  telemetryData?: TelemetryData;
  tagInfo?: TagInfo;
}

export interface MergeResult {
  tasks?: Task[];
  updatedSubtask?: Subtask;
  newlyAddedSnippet?: string;
  updateCount: number;
  mode: 'structured' | 'timestamped';
}
```

---

## Implementation Phases

### Phase 1: Foundation & Core Types

**Goal**: Establish the type system and interfaces

**New Files to Create**:
1. `packages/tm-core/src/commands/update-task/types.ts`
   - Define `UpdateMode` enum
   - Define all shared interfaces (`UpdateTaskOptions`, `UpdateTaskResult`, etc.)
2. `packages/tm-core/src/commands/update-task/interfaces/update-strategy.interface.ts`
   - Define `IUpdateStrategy` interface
3. `packages/tm-core/src/commands/update-task/interfaces/update-context.interface.ts`
   - Define `IUpdateContext` interface
4. `packages/tm-core/src/commands/update-task/interfaces/display.interface.ts`
   - Define `IDisplayManager` interface

**Existing Classes to Study**:
- `BaseExecutor` - For abstract class patterns
- `TaskService` - For service patterns
- `IStorage` - For interface patterns

---

### Phase 2: Validator & Helper Utilities

**Goal**: Build validation and utility classes

**New Files to Create**:
1. `packages/tm-core/src/commands/update-task/validators/update-input.validator.ts`
   - Create `UpdateInputValidator` class
   - Port validation logic from both old files
2. `packages/tm-core/src/commands/update-task/validators/task-id.validator.ts`
   - Create `TaskIdValidator` class
   - Implement `validateTaskId()` and `parseSubtaskId()` methods

**Tests to Create**:
- `update-input.validator.spec.ts`
- `task-id.validator.spec.ts`

---

### Phase 3: Service Layer

**Goal**: Build the helper services that strategies will use

**New Files to Create**:
1. `packages/tm-core/src/commands/update-task/context-builder.service.ts`
   - Create `ContextBuilderService` class
   - **Uses existing**: `ContextGatherer`, `FuzzyTaskSearch`
   - Port context gathering logic from both old files

2. `packages/tm-core/src/commands/update-task/prompt-builder.service.ts`
   - Create `PromptBuilderService` class
   - **Uses existing**: `PromptManager` (via `getPromptManager()`)
   - Port prompt building logic

3. `packages/tm-core/src/commands/update-task/data-merger.service.ts`
   - Create `DataMergerService` class
   - Implement `mergeTasks()` method (from `update-tasks.js` lines 250-273)
   - Implement `mergeSubtask()` method (from `update-subtask-by-id.js` lines 291-332)

**Tests to Create**:
- `context-builder.service.spec.ts`
- `prompt-builder.service.spec.ts`
- `data-merger.service.spec.ts`

**Existing Classes Used**:
- `ContextGatherer` (from `scripts/modules/utils/contextGatherer.js`)
- `FuzzyTaskSearch` (from `scripts/modules/utils/fuzzyTaskSearch.js`)
- `PromptManager` (from `scripts/modules/prompt-manager.js`)

---

### Phase 4: Strategy Pattern Implementation

**Goal**: Implement the update strategies

**New Files to Create**:
1. `packages/tm-core/src/commands/update-task/strategies/base-update.strategy.ts`
   - Create `BaseUpdateStrategy` abstract class implementing `IUpdateStrategy`
   - Implement template method pattern
   - Define abstract methods for subclasses

2. `packages/tm-core/src/commands/update-task/strategies/bulk-update.strategy.ts`
   - Create `BulkUpdateStrategy` class extending `BaseUpdateStrategy`
   - Port logic from `update-tasks.js` lines 79-293
   - **Uses**: `generateObjectService` with `COMMAND_SCHEMAS['update-tasks']`

3. `packages/tm-core/src/commands/update-task/strategies/single-task-update.strategy.ts`
   - Create `SingleTaskUpdateStrategy` class extending `BaseUpdateStrategy`
   - Similar to bulk but for single task
   - **Uses**: `generateObjectService` with `COMMAND_SCHEMAS['update-tasks']`

4. `packages/tm-core/src/commands/update-task/strategies/subtask-update.strategy.ts`
   - Create `SubtaskUpdateStrategy` class extending `BaseUpdateStrategy`
   - Port logic from `update-subtask-by-id.js` lines 67-378
   - **Uses**: `generateTextService` for freeform content

**Tests to Create**:
- `bulk-update.strategy.spec.ts`
- `single-task-update.strategy.spec.ts`
- `subtask-update.strategy.spec.ts`

**Existing Classes/Functions Used**:
- `generateObjectService` (from `scripts/modules/ai-services-unified.js`)
- `generateTextService` (from `scripts/modules/ai-services-unified.js`)
- `COMMAND_SCHEMAS` (from `src/schemas/registry.js`)
- `readJSON`, `writeJSON`, `flattenTasksWithSubtasks` (from `scripts/modules/utils.js`)

---

### Phase 5: Display Layer

**Goal**: Implement display managers for different output formats

**New Files to Create**:
1. `packages/tm-core/src/commands/update-task/display/cli-display.manager.ts`
   - Create `CLIDisplayManager` class implementing `IDisplayManager`
   - Port CLI display logic from both old files
   - **Uses existing**: `chalk`, `boxen`, `cli-table3`, `getStatusWithColor`, `truncate`

2. `packages/tm-core/src/commands/update-task/display/json-display.manager.ts`
   - Create `JSONDisplayManager` class implementing `IDisplayManager`
   - Implement JSON output format (for MCP)

3. `packages/tm-core/src/commands/update-task/display/update-display.factory.ts`
   - Create `UpdateDisplayFactory` class
   - Factory method to create appropriate display manager

**Tests to Create**:
- `cli-display.manager.spec.ts`
- `json-display.manager.spec.ts`

**Existing Functions Used**:
- `getStatusWithColor`, `startLoadingIndicator`, `stopLoadingIndicator`, `displayAiUsageSummary` (from `scripts/modules/ui.js`)
- `truncate`, `isSilentMode` (from `scripts/modules/utils.js`)

---

### Phase 6: Factory Pattern

**Goal**: Implement factory for creating strategies

**New Files to Create**:
1. `packages/tm-core/src/commands/update-task/factories/update-strategy.factory.ts`
   - Create `UpdateStrategyFactory` class
   - Implement `createStrategy(mode)` method
   - Implement `detectMode(options)` method
   - Handles dependency injection for all strategies

**Tests to Create**:
- `update-strategy.factory.spec.ts` (test mode detection and strategy creation)

---

### Phase 7: Main Service Orchestrator

**Goal**: Create the main service that ties everything together

**New Files to Create**:
1. `packages/tm-core/src/commands/update-task/update-task.service.ts`
   - Create `UpdateTaskService` class
   - Main orchestrator that coordinates all components
   - Implements high-level workflow

2. `packages/tm-core/src/commands/update-task/index.ts`
   - Export all public types and interfaces
   - Export `createUpdateTaskService()` factory function
   - Export `UpdateTaskService` class

**Tests to Create**:
- `update-task.service.spec.ts` (integration tests)

**Existing Classes Used**:
- `ConfigManager` (from `packages/tm-core/src/config/config-manager.ts`)
- `IStorage` (from `packages/tm-core/src/interfaces/storage.interface.ts`)
- `Logger`, `getLogger` (from `packages/tm-core/src/logger/`)

---

### Phase 8: CLI Integration

**Goal**: Wire up the new service to the CLI

**New Files to Create**:
1. `apps/cli/src/commands/update-task.command.ts`
   - CLI command definition using `commander`
   - Calls `createUpdateTaskService()` and executes
   - Handles CLI-specific argument parsing

**Files to Modify**:
1. `apps/cli/src/index.ts` (or main CLI entry point)
   - Register new `update-task` command
   - Optionally add aliases for backward compatibility

**Existing Patterns to Follow**:
- Study existing CLI commands in `apps/cli/src/commands/`
- Follow same pattern for option parsing and service invocation

---

### Phase 9: Integration & Testing

**Goal**: Ensure everything works together

**Tasks**:
1. Run full integration tests
   - Test bulk update workflow end-to-end
   - Test single task update workflow
   - Test subtask update workflow
   - Test MCP mode vs CLI mode
   - Test all edge cases from checklist

2. Verify against original functionality
   - Use the functionality checklist
   - Ensure no regressions
   - Test with real task data

3. Performance testing
   - Compare execution time with old implementation
   - Ensure context gathering performs well

**Tests to Create**:
- `update-task.integration.spec.ts` - Full workflow tests
- End-to-end tests with real task files

---

### Phase 10: Documentation & Migration

**Goal**: Document the new system and deprecate old code

**Tasks**:
1. Update documentation
   - Update `apps/docs/command-reference.mdx`
   - Add JSDoc comments to all public APIs
   - Create migration guide for users

2. Add deprecation warnings
   - Mark old `update` and `update-subtask` commands as deprecated
   - Add console warnings directing users to new command

3. Create changeset
   - Document breaking changes (if any)
   - Document new features (unified command)
   - Note backward compatibility

**Files to Modify**:
1. `apps/docs/command-reference.mdx` - Update command documentation
2. Legacy files (add deprecation warnings):
   - `scripts/modules/task-manager/update-tasks.js`
   - `scripts/modules/task-manager/update-subtask-by-id.js`

---

### Phase 11: Cleanup

**Goal**: Remove deprecated code (future version)

**Tasks**:
1. Remove old files:
   - `scripts/modules/task-manager/update-tasks.js`
   - `scripts/modules/task-manager/update-subtask-by-id.js`
   - Any related old command handlers

2. Clean up any temporary compatibility shims

3. Update all references in codebase to use new command

---

## Testing Strategy

### Unit Tests

- [ ] Mode detection logic
- [ ] ID parsing and validation
- [ ] Context gathering integration
- [ ] Prompt building for each mode
- [ ] Data merging logic

### Integration Tests

- [ ] Bulk update workflow
- [ ] Single task update workflow
- [ ] Single subtask update workflow
- [ ] MCP mode operation
- [ ] CLI mode operation

### Edge Cases

- [ ] Empty tasks.json
- [ ] Invalid ID formats
- [ ] Non-existent IDs
- [ ] Tasks with no subtasks
- [ ] Empty AI responses
- [ ] Context gathering failures

---

## Backward Compatibility

### Deprecation Strategy

1. Keep old commands working initially
2. Add deprecation warnings
3. Update all documentation
4. Remove old commands in next major version

### Alias Support (Optional)

```bash
# Could maintain old command names as aliases
task-master update --from=3 --prompt="..."    # Still works, calls update-task
task-master update-subtask --id=3.2 --prompt="..."  # Still works, calls update-task
```

---

## Risk Mitigation

### High-Risk Areas

1. **Data integrity**: Ensure writeJSON doesn't corrupt existing data
2. **AI service compatibility**: Both generateObjectService and generateTextService must work
3. **Subtask detail format**: Maintain timestamp format consistency
4. **Context gathering**: Same behavior across all modes

### Rollback Plan

- Keep old files until new version is fully tested
- Version bump allows reverting if issues found
- Comprehensive test coverage before release

---

## Success Criteria

- [ ] All checklist items verified working
- [ ] Tests passing for all modes
- [ ] MCP integration functional
- [ ] CLI display matches existing behavior
- [ ] Documentation updated
- [ ] No regression in existing functionality
- [ ] Performance comparable or better than current implementation
