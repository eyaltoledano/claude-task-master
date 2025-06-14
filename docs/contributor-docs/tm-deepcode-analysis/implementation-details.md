# Implementation Details

## Core Algorithms

### 1. Dependency Resolution

#### Cycle Detection Algorithm
```javascript
// Located in: scripts/modules/utils.js
function findCycles(tasks) {
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(taskId, path = []) {
    if (recursionStack.has(taskId)) {
      // Found cycle
      const cycleStart = path.indexOf(taskId);
      cycles.push(path.slice(cycleStart));
      return;
    }
    
    if (visited.has(taskId)) return;
    
    visited.add(taskId);
    recursionStack.add(taskId);
    path.push(taskId);
    
    const task = tasks.find(t => t.id === taskId);
    if (task && task.dependencies) {
      for (const dep of task.dependencies) {
        dfs(dep, [...path]);
      }
    }
    
    recursionStack.delete(taskId);
  }

  tasks.forEach(task => {
    if (!visited.has(task.id)) {
      dfs(task.id);
    }
  });

  return cycles;
}
```

**Complexity:** O(V + E) where V = tasks, E = dependencies

#### Next Task Selection
```javascript
// Located in: scripts/modules/task-manager/find-next-task.js
function findNextTask(tasks, complexityScores) {
  // Filter eligible tasks
  const eligibleTasks = tasks.filter(task => {
    if (task.status !== 'pending') return false;
    
    // Check dependencies
    const allDepsComplete = task.dependencies.every(depId => {
      const depTask = tasks.find(t => t.id === depId);
      return depTask && depTask.status === 'done';
    });
    
    return allDepsComplete;
  });

  // Sort by priority and complexity
  return eligibleTasks.sort((a, b) => {
    // Priority comparison
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Complexity comparison
    const complexityA = complexityScores?.[a.id]?.score || 50;
    const complexityB = complexityScores?.[b.id]?.score || 50;
    return complexityA - complexityB; // Lower complexity first
  })[0];
}
```

### 2. Task ID Management

#### ID Generation Strategy
```javascript
// Sequential ID assignment
function getNextTaskId(tasks) {
  if (!tasks || tasks.length === 0) return 1;
  return Math.max(...tasks.map(t => t.id)) + 1;
}

// Subtask ID format: "parentId.subtaskId"
function parseSubtaskId(id) {
  const parts = id.toString().split('.');
  if (parts.length !== 2) return null;
  
  return {
    parentId: parseInt(parts[0]),
    subtaskId: parseInt(parts[1])
  };
}
```

### 3. File System Operations

#### Atomic JSON Updates
```javascript
// Located in: scripts/modules/utils.js
function writeJSON(filePath, data) {
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write atomically (as atomic as Node.js allows)
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}
```

#### Task File Generation
```javascript
// Located in: scripts/modules/task-manager/generate-task-files.js
function generateTaskFiles(tasksPath, outputDir) {
  const data = readJSON(tasksPath);
  
  // Clean existing files
  const existingFiles = fs.readdirSync(outputDir)
    .filter(f => f.match(/^task-\d+\.md$/));
  
  existingFiles.forEach(file => {
    fs.unlinkSync(path.join(outputDir, file));
  });
  
  // Generate new files
  data.tasks.forEach(task => {
    const content = formatTaskAsMarkdown(task);
    const filename = `task-${task.id}.md`;
    fs.writeFileSync(path.join(outputDir, filename), content);
  });
}
```

## AI Integration Patterns

### 1. Prompt Engineering

#### Task Generation Prompt
```javascript
// Located in: scripts/modules/task-manager/parse-prd.js
const systemPrompt = `You are a senior software architect...
Generate exactly ${numTasks} discrete, actionable tasks...

Rules:
1. Tasks should be atomic and independently completable
2. Include clear descriptions and implementation details
3. Define test strategies for verification
4. Suggest logical dependencies
5. Assign appropriate priorities`;

const userPrompt = `PRD Content:\n${prdContent}\n\n
Generate ${numTasks} implementation tasks...`;
```

#### Task Expansion Prompt
```javascript
// Located in: scripts/modules/task-manager/expand-task.js
const expansionPrompt = `Break down this task into ${numSubtasks} subtasks:
Title: ${task.title}
Description: ${task.description}
Details: ${task.details}

Each subtask should:
- Be independently implementable
- Take 1-4 hours to complete
- Have clear success criteria
- Follow logical ordering`;
```

### 2. Response Parsing

#### Structured Output with Zod
```javascript
// AI response schema
const TaskSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    details: z.string().optional(),
    testStrategy: z.string().optional(),
    dependencies: z.array(z.number()).optional(),
    priority: z.enum(['high', 'medium', 'low'])
  }))
});

// Parse with validation
const result = await generateObject({
  model: aiModel,
  messages,
  schema: TaskSchema,
  mode: 'json'
});
```

### 3. Fallback Chain Implementation

```javascript
// Located in: scripts/modules/ai-services-unified.js
async function executeWithFallback(roles, operation) {
  const errors = [];
  
  for (const role of roles) {
    try {
      const provider = getProviderForRole(role);
      const result = await executeWithRetry(provider, operation);
      return result;
    } catch (error) {
      errors.push({ role, error });
      continue;
    }
  }
  
  throw new Error(`All providers failed: ${errors.map(e => e.error.message).join(', ')}`);
}
```

## Performance Optimizations

### 1. Caching Strategy

#### LRU Cache Implementation
```javascript
// Located in: mcp-server/src/core/context-manager.js
class ContextManager {
  constructor() {
    this.cache = new LRUCache({
      max: 100,
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true
    });
  }
  
  getCachedPath(key) {
    const cached = this.cache.get(key);
    if (cached) this.stats.hits++;
    else this.stats.misses++;
    return cached;
  }
}
```

### 2. Batch Operations

#### Parallel Task Processing
```javascript
// Process multiple tasks concurrently
async function expandAllTasks(tasks, options) {
  const BATCH_SIZE = 5;
  const results = [];
  
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(task => expandTask(task, options))
    );
    results.push(...batchResults);
  }
  
  return results;
}
```

### 3. File I/O Optimization

#### Lazy Loading Pattern
```javascript
// Only load tasks when needed
function getTasksLazy() {
  let tasksCache = null;
  
  return {
    get: () => {
      if (!tasksCache) {
        tasksCache = readJSON(tasksPath);
      }
      return tasksCache;
    },
    invalidate: () => {
      tasksCache = null;
    }
  };
}
```

## Error Handling Patterns

### 1. Graceful Degradation

```javascript
// Multiple fallback strategies
function findTasksFile(projectRoot) {
  const strategies = [
    () => path.join(projectRoot, 'tasks.json'),
    () => path.join(projectRoot, '.taskmaster', 'tasks.json'),
    () => path.join(process.cwd(), 'tasks.json')
  ];
  
  for (const strategy of strategies) {
    const filePath = strategy();
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  
  throw new Error('No tasks.json file found');
}
```

### 2. Error Wrapping

```javascript
// Consistent error context
class TaskMasterError extends Error {
  constructor(message, code, context) {
    super(message);
    this.code = code;
    this.context = context;
  }
}

function wrapError(error, context) {
  if (error instanceof TaskMasterError) {
    return error;
  }
  
  return new TaskMasterError(
    error.message,
    error.code || 'UNKNOWN',
    { ...context, originalError: error }
  );
}
```

## Security Measures

### 1. Path Traversal Prevention

```javascript
// Located in: src/utils/path-utils.js
function normalizePath(inputPath, baseDir) {
  // Resolve to absolute path
  const resolved = path.resolve(baseDir, inputPath);
  
  // Ensure path is within base directory
  const relative = path.relative(baseDir, resolved);
  if (relative.startsWith('..')) {
    throw new Error('Path traversal detected');
  }
  
  return resolved;
}
```

### 2. API Key Handling

```javascript
// Never log sensitive data
function sanitizeForLogging(config) {
  const sanitized = { ...config };
  
  const sensitiveKeys = ['apiKey', 'password', 'token'];
  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = '***';
    }
  }
  
  return sanitized;
}
```

## Testing Strategies

### 1. Mock File System

```javascript
// Located in: tests/unit/*/setup.js
beforeEach(() => {
  mockFs({
    '/project': {
      'tasks.json': JSON.stringify({
        tasks: [
          { id: 1, title: 'Test Task', status: 'pending' }
        ]
      })
    }
  });
});

afterEach(() => {
  mockFs.restore();
});
```

### 2. AI Provider Mocking

```javascript
// Mock AI responses
jest.mock('../ai-services-unified.js', () => ({
  generateText: jest.fn().mockResolvedValue({
    text: 'Mocked AI response',
    usage: { inputTokens: 100, outputTokens: 50 }
  })
}));
```

## Memory Management

### 1. Stream Processing

```javascript
// For large AI responses
async function* streamAIResponse(prompt) {
  const stream = await streamText({
    model: aiModel,
    messages: [{ role: 'user', content: prompt }]
  });
  
  for await (const chunk of stream) {
    yield chunk.text;
  }
}
```

### 2. Resource Cleanup

```javascript
// Ensure resources are released
class ResourceManager {
  constructor() {
    this.resources = new Set();
  }
  
  async cleanup() {
    for (const resource of this.resources) {
      try {
        await resource.close();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    this.resources.clear();
  }
}
```

## Configuration Management

### 1. Layered Configuration

```javascript
// Configuration precedence
function resolveConfig(key) {
  // 1. Environment variable
  if (process.env[key]) return process.env[key];
  
  // 2. Session data
  if (session?.[key]) return session[key];
  
  // 3. Config file
  if (config?.[key]) return config[key];
  
  // 4. Default value
  return defaults[key];
}
```

### 2. Dynamic Reloading

```javascript
// Watch for config changes
function watchConfig(configPath, callback) {
  let debounceTimer;
  
  fs.watch(configPath, (eventType) => {
    if (eventType === 'change') {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const newConfig = readJSON(configPath);
        callback(newConfig);
      }, 100);
    }
  });
}
```

## Integration Patterns

### 1. MCP Protocol Handling

```javascript
// Tool registration pattern
function registerTool(server, toolDef) {
  server.addTool({
    name: toolDef.name,
    description: toolDef.description,
    parameters: toolDef.schema,
    execute: withErrorHandling(
      withProjectRoot(
        withLogging(
          toolDef.handler
        )
      )
    )
  });
}
```

### 2. Provider Abstraction

```javascript
// Unified interface regardless of provider
class ProviderAdapter {
  async generateText(params) {
    const provider = this.getProvider();
    const model = provider.getModel(params.modelId);
    
    return this.normalizeResponse(
      await provider.generateText({
        ...params,
        model
      })
    );
  }
  
  normalizeResponse(response) {
    return {
      text: response.text || response.content,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0
      }
    };
  }
}
```