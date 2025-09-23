---
description: 
globs: 
alwaysApply: false
---
# Utility Function Guidelines

## General Principles

- **Function Scope**:
  - ✅ DO: Create utility functions that serve multiple modules
  - ✅ DO: Keep functions single-purpose and focused
  - ❌ DON'T: Include business logic in utility functions
  - ❌ DON'T: Create utilities with side effects

  ```javascript
  // ✅ DO: Create focused, reusable utilities
  /**
   * Truncates text to a specified length
   * @param {string} text - The text to truncate
   * @param {number} maxLength - The maximum length
   * @returns {string} The truncated text
   */
  function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength - 3) + '...';
  }
  ```

  ```javascript
  // ❌ DON'T: Add side effects to utilities
  function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    
    // Side effect - modifying global state or logging
    console.log(`Truncating text from ${text.length} to ${maxLength} chars`);
    
    return text.slice(0, maxLength - 3) + '...';
  }
  ```

- **Location**:
    - **Core CLI Utilities**: Place utilities used primarily by the core `task-master` CLI logic and command modules (`scripts/modules/*`) into [`scripts/modules/utils.js`](mdc:scripts/modules/utils.js).
    - **MCP Server Utilities**: Place utilities specifically designed to support the MCP server implementation into the appropriate subdirectories within `mcp-server/src/`.
        - Path/Core Logic Helpers: [`mcp-server/src/core/utils/`](mdc:mcp-server/src/core/utils) (e.g., `path-utils.js`).
        - Tool Execution/Response Helpers: [`mcp-server/src/tools/utils.js`](mdc:mcp-server/src/tools/utils.js).

## Documentation Standards

- **JSDoc Format**:
  - ✅ DO: Document all parameters and return values
  - ✅ DO: Include descriptions for complex logic
  - ✅ DO: Add examples for non-obvious usage
  - ❌ DON'T: Skip documentation for "simple" functions

  ```javascript
  // ✅ DO: Provide complete JSDoc documentation
  /**
   * Reads and parses a JSON file
   * @param {string} filepath - Path to the JSON file
   * @returns {Object|null} Parsed JSON data or null if error occurs
   */
  function readJSON(filepath) {
    try {
      const rawData = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(rawData);
    } catch (error) {
      log('error', `Error reading JSON file ${filepath}:`, error.message);
      if (CONFIG.debug) {
        console.error(error);
      }
      return null;
    }
  }
  ```

## Configuration Management (via `config-manager.js`)

Taskmaster configuration (excluding API keys) is primarily managed through the `.taskmasterconfig` file located in the project root and accessed via getters in [`scripts/modules/config-manager.js`](mdc:scripts/modules/config-manager.js).

- **`.taskmasterconfig` File**:
  - ✅ DO: Use this JSON file to store settings like AI model selections (main, research, fallback), parameters (temperature, maxTokens), logging level, default priority/subtasks, etc.
  - ✅ DO: Manage this file using the `task-master models --setup` CLI command or the `models` MCP tool.
  - ✅ DO: Rely on [`config-manager.js`](mdc:scripts/modules/config-manager.js) to load this file (using the correct project root passed from MCP or found via CLI utils), merge with defaults, and provide validated settings.
  - ❌ DON'T: Store API keys in this file.
  - ❌ DON'T: Manually edit this file unless necessary.

- **Configuration Getters (`config-manager.js`)**:
  - ✅ DO: Import and use specific getters from `config-manager.js` (e.g., `getMainProvider()`, `getLogLevel()`, `getMainMaxTokens()`) to access configuration values *needed for application logic* (like `getDefaultSubtasks`).
  - ✅ DO: Pass the `explicitRoot` parameter to getters if calling from MCP direct functions to ensure the correct project's config is loaded.
  - ❌ DON'T: Call AI-specific getters (like `getMainModelId`, `getMainMaxTokens`) from core logic functions (`scripts/modules/task-manager/*`). Instead, pass the `role` to the unified AI service.
  - ❌ DON'T: Access configuration values directly from environment variables (except API keys).

- **API Key Handling (`utils.js` & `ai-services-unified.js`)**:
  - ✅ DO: Store API keys **only** in `.env` (for CLI, loaded by `dotenv` in `scripts/dev.js`) or `.cursor/mcp.json` (for MCP, accessed via `session.env`).
  - ✅ DO: Use `isApiKeySet(providerName, session)` from `config-manager.js` to check if a provider's key is available *before* potentially attempting an AI call if needed, but note the unified service performs its own internal check.
  - ✅ DO: Understand that the unified service layer (`ai-services-unified.js`) internally resolves API keys using `resolveEnvVariable(key, session)` from `utils.js`.

- **Error Handling**:
  - ✅ DO: Handle potential `ConfigurationError` if the `.taskmasterconfig` file is missing or invalid when accessed via `getConfig` (e.g., in `commands.js` or direct functions).

## Logging Utilities (in `scripts/modules/utils.js`)

- **Log Levels**:
  - ✅ DO: Support multiple log levels (debug, info, warn, error)
  - ✅ DO: Use appropriate icons for different log levels
  - ✅ DO: Respect the configured log level
  - ❌ DON'T: Add direct console.log calls outside the logging utility
  - **Note on Passed Loggers**: When a logger object (like the FastMCP `log` object) is passed *as a parameter* (e.g., as `mcpLog`) into core Task Master functions, the receiving function often expects specific methods (`.info`, `.warn`, `.error`, etc.) to be directly callable on that object (e.g., `mcpLog[level](mdc:...)`). If the passed logger doesn't have this exact structure, a wrapper object may be needed. See the **Handling Logging Context (`mcpLog`)** section in [`mcp.mdc`](mdc:.cursor/rules/mcp.mdc) for the standard pattern used in direct functions.

- **Logger Wrapper Pattern**: 
  - ✅ DO: Use the logger wrapper pattern when passing loggers to prevent `mcpLog[level] is not a function` errors:
  ```javascript
  // Standard logWrapper pattern to wrap FastMCP's log object
  const logWrapper = {
    info: (message, ...args) => log.info(message, ...args),
    warn: (message, ...args) => log.warn(message, ...args),
    error: (message, ...args) => log.error(message, ...args),
    debug: (message, ...args) => log.debug && log.debug(message, ...args),
    success: (message, ...args) => log.info(message, ...args) // Map success to info
  };
  
  // Pass this wrapper as mcpLog to ensure consistent method availability
  // This also ensures output format is set to 'json' in many core functions
  const options = { mcpLog: logWrapper, session };
  ```
  - ✅ DO: Implement this pattern in any direct function that calls core functions expecting `mcpLog`
  - ✅ DO: Use this solution in conjunction with silent mode for complete output control
  - ❌ DON'T: Pass the FastMCP `log` object directly as `mcpLog` to core functions
  - **Important**: This pattern has successfully fixed multiple issues in MCP tools (e.g., `update-task`, `update-subtask`) where using or omitting `mcpLog` incorrectly led to runtime errors or JSON parsing failures.
  - For complete implementation details, see the **Handling Logging Context (`mcpLog`)** section in [`mcp.mdc`](mdc:.cursor/rules/mcp.mdc).

  ```javascript
  // ✅ DO: Implement a proper logging utility
  const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  
  function log(level, ...args) {
    const icons = {
      debug: chalk.gray('🔍'),
      info: chalk.blue('ℹ️'),
      warn: chalk.yellow('⚠️'),
      error: chalk.red('❌'),
      success: chalk.green('✅')
    };
    
    if (LOG_LEVELS[level] >= LOG_LEVELS[CONFIG.logLevel]) {
      const icon = icons[level] || '';
      console.log(`${icon} ${args.join(' ')}`);
    }
  }
  ```

## Silent Mode Utilities (in `scripts/modules/utils.js`)

- **Silent Mode Control**:
  - ✅ DO: Use the exported silent mode functions rather than accessing global variables
  - ✅ DO: Always use `isSilentMode()` to check the current silent mode state
  - ✅ DO: Ensure silent mode is disabled in a `finally` block to prevent it from staying enabled
  - ❌ DON'T: Access the global `silentMode` variable directly
  - ❌ DON'T: Forget to disable silent mode after enabling it

  ```javascript
  // ✅ DO: Use the silent mode control functions properly
  
  // Example of proper implementation in utils.js:
  
  // Global silent mode flag (private to the module)
  let silentMode = false;
  
  // Enable silent mode
  function enableSilentMode() {
    silentMode = true;
  }
  
  // Disable silent mode
  function disableSilentMode() {
    silentMode = false;
  }
  
  // Check if silent mode is enabled
  function isSilentMode() {
    return silentMode;
  }
  
  // Example of proper usage in another module:
  import { enableSilentMode, disableSilentMode, isSilentMode } from './utils.js';
  
  // Check current status
  if (!isSilentMode()) {
    console.log('Silent mode is not enabled');
  }
  
  // Use try/finally pattern to ensure silent mode is disabled
  try {
    enableSilentMode();
    // Do something that should suppress console output
    performOperation();
  } finally {
    disableSilentMode();
  }
  ```

- **Integration with Logging**:
  - ✅ DO: Make the `log` function respect silent mode
  ```javascript
  function log(level, ...args) {
    // Skip logging if silent mode is enabled
    if (isSilentMode()) {
      return;
    }
    
    // Rest of logging logic...
  }
  ```

- **Common Patterns for Silent Mode**:
  - ✅ DO: In **direct functions** (`mcp-server/src/core/direct-functions/*`) that call **core functions** (`scripts/modules/*`), ensure console output from the core function is suppressed to avoid breaking MCP JSON responses.
    - **Preferred Method**: Update the core function to accept an `outputFormat` parameter (e.g., `outputFormat = 'text'`) and make it check `outputFormat === 'text'` before displaying any UI elements (banners, spinners, boxes, direct `console.log`s). Pass `'json'` from the direct function.
    - **Necessary Fallback/Guarantee**: If the core function *cannot* be modified or its output suppression via `outputFormat` is unreliable, **wrap the core function call within the direct function** using `enableSilentMode()` and `disableSilentMode()` in a `try/finally` block. This acts as a safety net.
  ```javascript
  // Example in a direct function
  export async function someOperationDirect(args, log) {
    let result;
    const tasksPath = findTasksJsonPath(args, log); // Get path first
    
    // Option 1: Core function handles 'json' format (Preferred)
    try {
      result = await coreFunction(tasksPath, ...otherArgs, 'json'); // Pass 'json'
      return { success: true, data: result, fromCache: false };
    } catch (error) {
      // Handle error...
    }

    // Option 2: Core function output unreliable (Fallback/Guarantee)
    try {
      enableSilentMode(); // Enable before call
      result = await coreFunction(tasksPath, ...otherArgs); // Call without format param
    } catch (error) {
      // Handle error...
      log.error(`Failed: ${error.message}`);
      return { success: false, error: { /* ... */ } };
    } finally {
      disableSilentMode(); // ALWAYS disable in finally
    }
    return { success: true, data: result, fromCache: false }; // Assuming success if no error caught
  }
  ```
  - ✅ DO: For functions that accept a silent mode parameter but also need to check global state (less common):
  ```javascript
  // Check both the passed parameter and global silent mode
  const isSilent = options.silentMode || (typeof options.silentMode === 'undefined' && isSilentMode());
  ```

## File Operations (in `scripts/modules/utils.js`)

- **Error Handling**:
  - ✅ DO: Use try/catch blocks for all file operations
  - ✅ DO: Return null or a default value on failure
  - ✅ DO: Log detailed error information using the `log` utility
  - ❌ DON'T: Allow exceptions to propagate unhandled from simple file reads/writes

  ```javascript
  // ✅ DO: Handle file operation errors properly in core utils
  function writeJSON(filepath, data) {
    try {
      // Ensure directory exists (example)
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    } catch (error) {
      log('error', `Error writing JSON file ${filepath}:`, error.message);
      if (CONFIG.debug) {
        console.error(error);
      }
    }
  }
  ```

## Task-Specific Utilities (in `scripts/modules/utils.js`)

- **Task ID Formatting**:
  - ✅ DO: Create utilities for consistent ID handling
  - ✅ DO: Support different ID formats (numeric, string, dot notation)
  - ❌ DON'T: Duplicate formatting logic across modules

  ```javascript
  // ✅ DO: Create utilities for common operations
  /**
   * Formats a task ID as a string
   * @param {string|number} id - The task ID to format
   * @returns {string} The formatted task ID
   */
  function formatTaskId(id) {
    if (typeof id === 'string' && id.includes('.')) {
      return id; // Already formatted as a string with a dot (e.g., "1.2")
    }
    
    if (typeof id === 'number') {
      return id.toString();
    }
    
    return id;
  }
  ```

- **Task Search**:
  - ✅ DO: Implement reusable task finding utilities
  - ✅ DO: Support both task and subtask lookups
  - ✅ DO: Add context to subtask results

  ```javascript
  // ✅ DO: Create comprehensive search utilities
  /**
   * Finds a task by ID in the tasks array
   * @param {Array} tasks - The tasks array
   * @param {string|number} taskId - The task ID to find
   * @returns {Object|null} The task object or null if not found
   */
  function findTaskById(tasks, taskId) {
    if (!taskId || !tasks || !Array.isArray(tasks)) {
      return null;
    }
    
    // Check if it's a subtask ID (e.g., "1.2")
    if (typeof taskId === 'string' && taskId.includes('.')) {
      const [parentId, subtaskId] = taskId.split('.').map(id => parseInt(id, 10));
      const parentTask = tasks.find(t => t.id === parentId);
      
      if (!parentTask || !parentTask.subtasks) {
        return null;
      }
      
      const subtask = parentTask.subtasks.find(st => st.id === subtaskId);
      if (subtask) {
        // Add reference to parent task for context
        subtask.parentTask = { 
          id: parentTask.id, 
          title: parentTask.title,
          status: parentTask.status
        };
        subtask.isSubtask = true;
      }
      
      return subtask || null;
    }
    
    const id = parseInt(taskId, 10);
    return tasks.find(t => t.id === id) || null;
  }
  ```

## Cycle Detection (in `scripts/modules/utils.js`)

- **Graph Algorithms**:
  - ✅ DO: Implement cycle detection using graph traversal
  - ✅ DO: Track visited nodes and recursion stack
  - ✅ DO: Return specific information about cycles

  ```javascript
  // ✅ DO: Implement proper cycle detection
  /**
   * Find cycles in a dependency graph using DFS
   * @param {string} subtaskId - Current subtask ID
   * @param {Map} dependencyMap - Map of subtask IDs to their dependencies
   * @param {Set} visited - Set of visited nodes
   * @param {Set} recursionStack - Set of nodes in current recursion stack
   * @returns {Array} - List of dependency edges that need to be removed to break cycles
   */
  function findCycles(subtaskId, dependencyMap, visited = new Set(), recursionStack = new Set(), path = []) {
    // Mark the current node as visited and part of recursion stack
    visited.add(subtaskId);
    recursionStack.add(subtaskId);
    path.push(subtaskId);
    
    const cyclesToBreak = [];
    
    // Get all dependencies of the current subtask
    const dependencies = dependencyMap.get(subtaskId) || [];
    
    // For each dependency
    for (const depId of dependencies) {
      // If not visited, recursively check for cycles
      if (!visited.has(depId)) {
        const cycles = findCycles(depId, dependencyMap, visited, recursionStack, [...path]);
        cyclesToBreak.push(...cycles);
      } 
      // If the dependency is in the recursion stack, we found a cycle
      else if (recursionStack.has(depId)) {
        // The last edge in the cycle is what we want to remove
        cyclesToBreak.push(depId);
      }
    }
    
    // Remove the node from recursion stack before returning
    recursionStack.delete(subtaskId);
    
    return cyclesToBreak;
  }
  ```

## MCP Server Core Utilities (`mcp-server/src/core/utils/`)

### Project Root and Task File Path Detection (`path-utils.js`)

- **Purpose**: This module ([`mcp-server/src/core/utils/path-utils.js`](mdc:mcp-server/src/core/utils/path-utils.js)) provides the mechanism for locating the user's `tasks.json` file, used by direct functions.
- **`findTasksJsonPath(args, log)`**:
    - ✅ **DO**: Call this function from within **direct function wrappers** (e.g., `listTasksDirect` in `mcp-server/src/core/direct-functions/`) to get the absolute path to the relevant `tasks.json`.
    - Pass the *entire `args` object* received by the MCP tool (which should include `projectRoot` derived from the session) and the `log` object.
    - Implements a **simplified precedence system** for finding the `tasks.json` path:
        1.  Explicit `projectRoot` passed in `args` (Expected from MCP tools).
        2.  Cached `lastFoundProjectRoot` (CLI fallback).
        3.  Search upwards from `process.cwd()` (CLI fallback).
    - Throws a specific error if the `tasks.json` file cannot be located.
    - Updates the `lastFoundProjectRoot` cache on success.
- **`PROJECT_MARKERS`**: An exported array of common file/directory names used to identify a likely project root during the CLI fallback search.
- **`getPackagePath()`**: Utility to find the installation path of the `task-master-ai` package itself (potentially removable).

## MCP Server Tool Utilities (`mcp-server/src/tools/utils.js`)

These utilities specifically support the implementation and execution of MCP tools.

- **`normalizeProjectRoot(rawPath, log)`**:
    - **Purpose**: Takes a raw project root path (potentially URI encoded, with `file://` prefix, Windows slashes) and returns a normalized, absolute path suitable for the server's OS.
    - **Logic**: Decodes URI, strips `file://`, handles Windows drive prefix (`/C:/`), replaces `\` with `/`, uses `path.resolve()`.
    - **Usage**: Used internally by `withNormalizedProjectRoot` HOF.

- **`getRawProjectRootFromSession(session, log)`**:
    - **Purpose**: Extracts the *raw* project root URI string from the session object (`session.roots[0].uri` or `session.roots.roots[0].uri`) without performing normalization.
    - **Usage**: Used internally by `withNormalizedProjectRoot` HOF as a fallback if `args.projectRoot` isn't provided.

- **`withNormalizedProjectRoot(executeFn)`**:
    - **Purpose**: A Higher-Order Function (HOF) designed to wrap a tool's `execute` method.
    - **Logic**: 
        1. Determines the raw project root (from `args.projectRoot` or `getRawProjectRootFromSession`).
        2. Normalizes the raw path using `normalizeProjectRoot`.
        3. Injects the normalized, absolute path back into the `args` object as `args.projectRoot`.
        4. Calls the original `executeFn` with the updated `args`.
    - **Usage**: Should wrap the `execute` function of *every* MCP tool that needs a reliable, normalized project root path.
    - **Example**:
      ```javascript
      // In mcp-server/src/tools/your-tool.js
      import { withNormalizedProjectRoot } from './utils.js';
      
      export function registerYourTool(server) {
          server.addTool({
              // ... name, description, parameters ...
              execute: withNormalizedProjectRoot(async (args, context) => {
                  // args.projectRoot is now normalized here
                  const { projectRoot /*, other args */ } = args;
                  // ... rest of tool logic using normalized projectRoot ...
              })
          });
      }
      ```

- **`handleApiResult(result, log, errorPrefix, processFunction)`**:
    - **Purpose**: Standardizes the formatting of responses returned by direct functions (`{ success, data/error, fromCache }`) into the MCP response format.
    - **Usage**: Call this at the end of the tool's `execute` method, passing the result from the direct function call.

- **`createContentResponse(content)` / `createErrorResponse(errorMessage)`**:
    - **Purpose**: Helper functions to create the basic MCP response structure for success or error messages.
    - **Usage**: Used internally by `handleApiResult` and potentially directly for simple responses.

- **`createLogWrapper(log)`**:
    - **Purpose**: Creates a logger object wrapper with standard methods (`info`, `warn`, `error`, `debug`, `success`) mapping to the passed MCP `log` object's methods. Ensures compatibility when passing loggers to core functions.
    - **Usage**: Used within direct functions before passing the `log` object down to core logic that expects the standard method names.

- **`getCachedOrExecute({ cacheKey, actionFn, log })`**:
    - **Purpose**: Utility for implementing caching within direct functions. Checks cache for `cacheKey`; if miss, executes `actionFn`, caches successful result, and returns.
    - **Usage**: Wrap the core logic execution within a direct function call.

- **`processMCPResponseData(taskOrData, fieldsToRemove)`**:
    - **Purpose**: Utility to filter potentially sensitive or large fields (like `details`, `testStrategy`) from task objects before sending the response back via MCP.
    - **Usage**: Passed as the default `processFunction` to `handleApiResult`.

- **`getProjectRootFromSession(session, log)`**:
    - **Purpose**: Legacy function to extract *and normalize* the project root from the session. Replaced by the HOF pattern but potentially still used.
    - **Recommendation**: Prefer using the `withNormalizedProjectRoot` HOF in tools instead of calling this directly.

- **`executeTaskMasterCommand(...)`**: 
    - **Purpose**: Executes `task-master` CLI command as a fallback. 
    - **Recommendation**: Deprecated for most uses; prefer direct function calls.

## Export Organization

- **Grouping Related Functions**:
  - ✅ DO: Keep utilities relevant to their location (e.g., core CLI utils in `scripts/modules/utils.js`, MCP path utils in `mcp-server/src/core/utils/path-utils.js`, MCP tool utils in `mcp-server/src/tools/utils.js`).
  - ✅ DO: Export all utility functions in a single statement per file.
  - ✅ DO: Group related exports together.
  - ✅ DO: Export configuration constants (from `scripts/modules/utils.js`).
  - ❌ DON'T: Use default exports.
  - ❌ DON'T: Create circular dependencies (See [`architecture.mdc`](mdc:.cursor/rules/architecture.mdc)).

```javascript
// Example export from scripts/modules/utils.js
export {
  // Configuration
  CONFIG,
  LOG_LEVELS,
  
  // Logging
  log,
  
  // File operations
  readJSON,
  writeJSON,
  
  // String manipulation
  sanitizePrompt,
  truncate,
  
  // Task utilities
  // ... (taskExists, formatTaskId, findTaskById, etc.)
  
  // Graph algorithms
  findCycles,
};

// Example export from mcp-server/src/core/utils/path-utils.js
export {
  findTasksJsonPath,
  getPackagePath,
  PROJECT_MARKERS,
  lastFoundProjectRoot // Exporting for potential direct use/reset if needed
};

// Example export from mcp-server/src/tools/utils.js
export {
  getProjectRoot,
  getProjectRootFromSession,
  handleApiResult,
  executeTaskMasterCommand,
  processMCPResponseData,
  createContentResponse,
  createErrorResponse,
  getCachedOrExecute
};
```

## Context Gathering Utilities

### **ContextGatherer** (`scripts/modules/utils/contextGatherer.js`)

- **Multi-Source Context Extraction**:
  - ✅ DO: Use for AI-powered commands that need project context
  - ✅ DO: Support tasks, files, custom text, and project tree context
  - ✅ DO: Implement detailed token counting with `gpt-tokens` library
  - ✅ DO: Provide multiple output formats (research, chat, system-prompt)

  ```javascript
  // ✅ DO: Use ContextGatherer for consistent context extraction
  import { ContextGatherer } from '../utils/contextGatherer.js';
  
  const gatherer = new ContextGatherer(projectRoot, tasksPath);
  const result = await gatherer.gather({
    tasks: ['15', '16.2'],
    files: ['src/api.js'],
    customContext: 'Additional context',
    includeProjectTree: true,
    format: 'research',
    includeTokenCounts: true
  });
  ```

### **FuzzyTaskSearch** (`scripts/modules/utils/fuzzyTaskSearch.js`)

- **Intelligent Task Discovery**:
  - ✅ DO: Use for automatic task relevance detection
  - ✅ DO: Configure search parameters based on use case context
  - ✅ DO: Implement purpose-based categorization for better matching
  - ✅ DO: Sort results by relevance score and task ID

  ```javascript
  // ✅ DO: Use FuzzyTaskSearch for intelligent task discovery
  import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';
  
  const fuzzySearch = new FuzzyTaskSearch(tasksData.tasks, 'research');
  const searchResults = fuzzySearch.findRelevantTasks(query, {
    maxResults: 8,
    includeRecent: true,
    includeCategoryMatches: true
  });
  const taskIds = fuzzySearch.getTaskIds(searchResults);
  ```

- **Integration Guidelines**:
  - ✅ DO: Use fuzzy search to supplement user-provided task IDs
  - ✅ DO: Display discovered task IDs to users for transparency
  - ✅ DO: Sort discovered task IDs numerically for better readability
  - ❌ DON'T: Replace explicit user task selections with fuzzy results

Refer to [`context_gathering.mdc`](mdc:.cursor/rules/context_gathering.mdc) for detailed implementation patterns, [`mcp.mdc`](mdc:.cursor/rules/mcp.mdc) and [`architecture.mdc`](mdc:.cursor/rules/architecture.mdc) for more context on MCP server architecture and integration. 

## File System Operations

- **JSON File Handling**:
  - ✅ DO: Use `readJSON` and `writeJSON` for all JSON operations
  - ✅ DO: Include error handling for file operations
  - ✅ DO: Validate JSON structure after reading
  - ❌ DON'T: Use raw `fs.readFileSync` or `fs.writeFileSync` for JSON

  ```javascript
  // ✅ DO: Use utility functions with error handling
  function readJSON(filepath) {
    try {
      if (!fs.existsSync(filepath)) {
        return null; // or appropriate default
      }
      
      let data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      
      // Silent migration for tasks.json files: Transform old format to tagged format
      const isTasksFile = filepath.includes('tasks.json') || path.basename(filepath) === 'tasks.json';
      
      if (data && data.tasks && Array.isArray(data.tasks) && !data.master && isTasksFile) {
        // Migrate from old format { "tasks": [...] } to new format { "master": { "tasks": [...] } }
        const migratedData = {
          master: {
            tasks: data.tasks
          }
        };
        
        writeJSON(filepath, migratedData);
        
        // Set global flag for CLI notice and perform complete migration
        global.taskMasterMigrationOccurred = true;
        performCompleteTagMigration(filepath);
        
        data = migratedData;
      }
      
      return data;
    } catch (error) {
      log('error', `Failed to read JSON from ${filepath}: ${error.message}`);
      return null;
    }
  }
  
  function writeJSON(filepath, data) {
    try {
      const dirPath = path.dirname(filepath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    } catch (error) {
      log('error', `Failed to write JSON to ${filepath}: ${error.message}`);
      throw error;
    }
  }
  ```

- **Path Resolution**:
  - ✅ DO: Use `path.join()` for cross-platform path construction
  - ✅ DO: Use `path.resolve()` for absolute paths
  - ✅ DO: Validate paths before file operations

  ```javascript
  // ✅ DO: Handle paths correctly
  function findProjectRoot(startPath = process.cwd()) {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;
    
    while (currentPath !== rootPath) {
      const taskMasterPath = path.join(currentPath, '.taskmaster');
      if (fs.existsSync(taskMasterPath)) {
        return currentPath;
      }
      currentPath = path.dirname(currentPath);
    }
    
    return null; // Not found
  }
  ```

## Tagged Task Lists System Utilities

- **Tag Resolution Functions**:
  - ✅ DO: Use tag resolution layer for all task data access
  - ✅ DO: Provide backward compatibility with legacy format
  - ✅ DO: Default to "master" tag when no tag is specified

  ```javascript
  // ✅ DO: Implement tag resolution functions
  function getTasksForTag(data, tagName = 'master') {
    if (!data) {
      return [];
    }
    
    // Handle legacy format - direct tasks array
    if (data.tasks && Array.isArray(data.tasks)) {
      return data.tasks;
    }
    
    // Handle tagged format - tasks under specific tag
    if (data[tagName] && data[tagName].tasks && Array.isArray(data[tagName].tasks)) {
      return data[tagName].tasks;
    }
    
    return [];
  }
  
  function setTasksForTag(data, tagName = 'master', tasks) {
    // Ensure data object exists
    if (!data) {
      data = {};
    }
    
    // Create tag structure if it doesn't exist
    if (!data[tagName]) {
      data[tagName] = {};
    }
    
    // Set tasks for the tag
    data[tagName].tasks = tasks;
    
    return data;
  }
  
  function getCurrentTag() {
    // Get current tag from state.json or default to 'master'
    try {
      const projectRoot = findProjectRoot();
      if (!projectRoot) return 'master';
      
      const statePath = path.join(projectRoot, '.taskmaster', 'state.json');
      if (fs.existsSync(statePath)) {
        const state = readJSON(statePath);
        return state.currentTag || 'master';
      }
    } catch (error) {
      log('debug', `Error reading current tag: ${error.message}`);
    }
    
    return 'master';
  }
  ```

- **Migration Functions**:
  - ✅ DO: Implement complete migration for all related files
  - ✅ DO: Handle configuration and state file creation
  - ✅ DO: Provide migration status tracking

  ```javascript
  // ✅ DO: Implement complete migration system
  function performCompleteTagMigration(tasksJsonPath) {
    try {
      // Derive project root from tasks.json path
      const projectRoot = findProjectRoot(path.dirname(tasksJsonPath)) || path.dirname(tasksJsonPath);
      
      // 1. Migrate config.json - add defaultTag and tags section
      const configPath = path.join(projectRoot, '.taskmaster', 'config.json');
      if (fs.existsSync(configPath)) {
        migrateConfigJson(configPath);
      }
      
      // 2. Create state.json if it doesn't exist
      const statePath = path.join(projectRoot, '.taskmaster', 'state.json');
      if (!fs.existsSync(statePath)) {
        createStateJson(statePath);
      }
      
      if (getDebugFlag()) {
        log('debug', 'Completed tagged task lists migration for project');
      }
    } catch (error) {
      if (getDebugFlag()) {
        log('warn', `Error during complete tag migration: ${error.message}`);
      }
    }
  }
  
  function migrateConfigJson(configPath) {
    try {
      const config = readJSON(configPath);
      if (!config) return;
      
      let modified = false;
      
      // Add global.defaultTag if missing
      if (!config.global) {
        config.global = {};
      }
      if (!config.global.defaultTag) {
        config.global.defaultTag = 'master';
        modified = true;
      }
      
      // Add tags section if missing
      if (!config.tags) {
        config.tags = {
                  // Git integration settings removed - now manual only
        };
        modified = true;
      }
      
      if (modified) {
        writeJSON(configPath, config);
        if (getDebugFlag()) {
          log('debug', 'Updated config.json with tagged task system settings');
        }
      }
    } catch (error) {
      if (getDebugFlag()) {
        log('warn', `Error migrating config.json: ${error.message}`);
      }
    }
  }
  
  function createStateJson(statePath) {
    try {
      const initialState = {
        currentTag: 'master',
        lastSwitched: new Date().toISOString(),
        migrationNoticeShown: false
      };
      
      writeJSON(statePath, initialState);
      if (getDebugFlag()) {
        log('debug', 'Created initial state.json for tagged task system');
      }
    } catch (error) {
      if (getDebugFlag()) {
        log('warn', `Error creating state.json: ${error.message}`);
      }
    }
  }
  
  function markMigrationForNotice() {
    try {
      const projectRoot = findProjectRoot();
      if (!projectRoot) return;
      
      const statePath = path.join(projectRoot, '.taskmaster', 'state.json');
      const state = readJSON(statePath) || {};
      
      state.migrationNoticeShown = false; // Reset to show notice
      writeJSON(statePath, state);
    } catch (error) {
      if (getDebugFlag()) {
        log('warn', `Error marking migration for notice: ${error.message}`);
      }
    }
  }
  ```

## Logging Functions

- **Consistent Logging**:
  - ✅ DO: Use the central `log` function for all output
  - ✅ DO: Use appropriate log levels (info, warn, error, debug)
  - ✅ DO: Support silent mode for programmatic usage

  ```javascript
  // ✅ DO: Implement consistent logging with silent mode
  let silentMode = false;
  
  function log(level, ...messages) {
    if (silentMode && level !== 'error') {
      return; // Suppress non-error logs in silent mode
    }
    
    const timestamp = new Date().toISOString();
    const formattedMessage = messages.join(' ');
    
    switch (level) {
      case 'error':
        console.error(`[ERROR] ${formattedMessage}`);
        break;
      case 'warn':
        console.warn(`[WARN] ${formattedMessage}`);
        break;
      case 'info':
        console.log(`[INFO] ${formattedMessage}`);
        break;
      case 'debug':
        if (getDebugFlag()) {
          console.log(`[DEBUG] ${formattedMessage}`);
        }
        break;
      default:
        console.log(formattedMessage);
    }
  }
  
  function enableSilentMode() {
    silentMode = true;
  }
  
  function disableSilentMode() {
    silentMode = false;
  }
  
  function isSilentMode() {
    return silentMode;
  }
  ```

## Task Utilities

- **Task Finding and Manipulation**:
  - ✅ DO: Use tagged task system aware functions
  - ✅ DO: Handle both task and subtask operations
  - ✅ DO: Validate task IDs before operations

  ```javascript
  // ✅ DO: Implement tag-aware task utilities
  function findTaskById(tasks, taskId) {
    if (!Array.isArray(tasks)) {
      return null;
    }
    return tasks.find(task => task.id === taskId) || null;
  }
  
  function findSubtaskById(tasks, parentId, subtaskId) {
    const parentTask = findTaskById(tasks, parentId);
    if (!parentTask || !parentTask.subtasks) {
      return null;
    }
    
    return parentTask.subtasks.find(subtask => subtask.id === subtaskId) || null;
  }
  
  function getNextTaskId(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return 1;
    }
    
    const maxId = Math.max(...tasks.map(task => task.id));
    return maxId + 1;
  }
  
  function getNextSubtaskId(parentTask) {
    if (!parentTask.subtasks || parentTask.subtasks.length === 0) {
      return 1;
    }
    
    const maxId = Math.max(...parentTask.subtasks.map(subtask => subtask.id));
    return maxId + 1;
  }
  ```

## String Utilities

- **Text Processing**:
  - ✅ DO: Handle text truncation appropriately
  - ✅ DO: Provide consistent formatting functions
  - ✅ DO: Support different output formats

  ```javascript
  // ✅ DO: Implement useful string utilities
  function truncate(str, maxLength = 50) {
    if (!str || typeof str !== 'string') {
      return '';
    }
    
    if (str.length <= maxLength) {
      return str;
    }
    
    return str.substring(0, maxLength - 3) + '...';
  }
  
  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  function capitalizeFirst(str) {
    if (!str || typeof str !== 'string') {
      return '';
    }
    
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  ```

## Dependency Management Utilities

- **Dependency Analysis**:
  - ✅ DO: Detect circular dependencies
  - ✅ DO: Validate dependency references
  - ✅ DO: Support cross-tag dependency checking (future enhancement)

  ```javascript
  // ✅ DO: Implement dependency utilities
  function findCycles(tasks) {
    const cycles = [];
    const visited = new Set();
    const recStack = new Set();
    
    function dfs(taskId, path = []) {
      if (recStack.has(taskId)) {
        // Found a cycle
        const cycleStart = path.indexOf(taskId);
        const cycle = path.slice(cycleStart).concat([taskId]);
        cycles.push(cycle);
        return;
      }
      
      if (visited.has(taskId)) {
        return;
      }
      
      visited.add(taskId);
      recStack.add(taskId);
      
      const task = findTaskById(tasks, taskId);
      if (task && task.dependencies) {
        task.dependencies.forEach(depId => {
          dfs(depId, path.concat([taskId]));
        });
      }
      
      recStack.delete(taskId);
    }
    
    tasks.forEach(task => {
      if (!visited.has(task.id)) {
        dfs(task.id);
      }
    });
    
    return cycles;
  }
  
  function validateDependencies(tasks) {
    const validationErrors = [];
    const taskIds = new Set(tasks.map(task => task.id));
    
    tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies.forEach(depId => {
          if (!taskIds.has(depId)) {
            validationErrors.push({
              taskId: task.id,
              invalidDependency: depId,
              message: `Task ${task.id} depends on non-existent task ${depId}`
            });
          }
        });
      }
    });
    
    return validationErrors;
  }
  ```

## Environment and Configuration Utilities

- **Environment Variable Resolution**:
  - ✅ DO: Support both `.env` files and MCP session environment
  - ✅ DO: Provide fallbacks for missing values
  - ✅ DO: Handle API key resolution correctly

  ```javascript
  // ✅ DO: Implement flexible environment resolution
  function resolveEnvVariable(key, sessionEnv = null) {
    // First check session environment (for MCP)
    if (sessionEnv && sessionEnv[key]) {
      return sessionEnv[key];
    }
    
    // Then check process environment
    if (process.env[key]) {
      return process.env[key];
    }
    
    // Finally try .env file if in project root
    try {
      const projectRoot = findProjectRoot();
      if (projectRoot) {
        const envPath = path.join(projectRoot, '.env');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const lines = envContent.split('\n');
          
          for (const line of lines) {
            const [envKey, envValue] = line.split('=');
            if (envKey && envKey.trim() === key) {
              return envValue ? envValue.trim().replace(/^["']|["']$/g, '') : undefined;
            }
          }
        }
      }
    } catch (error) {
      log('debug', `Error reading .env file: ${error.message}`);
    }
    
    return undefined;
  }
  
  function getDebugFlag() {
    const debugFlag = resolveEnvVariable('TASKMASTER_DEBUG') || 
                     resolveEnvVariable('DEBUG') || 
                     'false';
    return debugFlag.toLowerCase() === 'true';
  }
  ```

## Export Pattern

- **Module Exports**:
  - ✅ DO: Export all utility functions explicitly
  - ✅ DO: Group related functions logically
  - ✅ DO: Include new tagged system utilities

  ```javascript
  // ✅ DO: Export utilities in logical groups
  module.exports = {
    // File system utilities
    readJSON,
    writeJSON,
    findProjectRoot,
    
    // Tagged task system utilities
    getTasksForTag,
    setTasksForTag,
    getCurrentTag,
    performCompleteTagMigration,
    migrateConfigJson,
    createStateJson,
    markMigrationForNotice,
    
    // Logging utilities
    log,
    enableSilentMode,
    disableSilentMode,
    isSilentMode,
    
    // Task utilities
    findTaskById,
    findSubtaskById,
    getNextTaskId,
    getNextSubtaskId,
    
    // String utilities
    truncate,
    formatDuration,
    capitalizeFirst,
    
    // Dependency utilities
    findCycles,
    validateDependencies,
    
    // Environment utilities
    resolveEnvVariable,
    getDebugFlag,
    
    // Legacy utilities (maintained for compatibility)
    aggregateTelemetry
  };
  ```

Refer to [`utils.js`](mdc:scripts/modules/utils.js) for implementation examples and [`architecture.mdc`](mdc:.cursor/rules/architecture.mdc) for integration patterns.
