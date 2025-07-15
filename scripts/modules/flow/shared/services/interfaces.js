/**
 * Service Interfaces for Dependency Injection
 * Defines the expected shape of each service for documentation and validation
 */

/**
 * @typedef {Object} Task
 * @property {string} id - Task identifier
 * @property {string} title - Task title
 * @property {string} description - Task description
 * @property {string} status - Task status (pending, in-progress, done, etc.)
 * @property {string} priority - Task priority (high, medium, low)
 * @property {Array<string>} dependencies - Array of dependent task IDs
 * @property {Array<Task>} [subtasks] - Optional array of subtasks
 */

/**
 * @typedef {Object} Tag
 * @property {string} name - Tag name
 * @property {string} [description] - Tag description
 * @property {number} taskCount - Number of tasks in this tag
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} ComplexityReport
 * @property {Array<Object>} tasks - Array of task complexity data
 * @property {Object} summary - Summary statistics
 * @property {Date} generatedAt - Report generation timestamp
 */

/**
 * Backend Service Interface
 * @typedef {Object} BackendService
 * @property {function(Object): Promise<{tasks: Array<Task>}>} getTasks - Get all tasks
 * @property {function(string): Promise<Task>} getTask - Get specific task by ID
 * @property {function(string, string): Promise<void>} setTaskStatus - Update task status
 * @property {function(Object): Promise<Object>} addTask - Create new task
 * @property {function(string, Object): Promise<Object>} updateTask - Update existing task
 * @property {function(string): Promise<void>} removeTask - Delete task
 * @property {function(string, Object): Promise<Object>} addSubtask - Add subtask to parent
 * @property {function(string, Object): Promise<Object>} updateSubtask - Update subtask
 * @property {function(string): Promise<void>} removeSubtask - Remove subtask
 * @property {function(): Promise<Array<Tag>>} getTags - Get all tags
 * @property {function(string, Object?): Promise<void>} addTag - Create new tag
 * @property {function(string): Promise<void>} deleteTag - Delete tag
 * @property {function(string): Promise<void>} useTag - Switch to tag
 * @property {function(string, Object): Promise<Object>} parsePRD - Parse PRD document
 * @property {function(string): Promise<ComplexityReport>} getComplexityReport - Get complexity analysis
 * @property {function(string, Object): Promise<Object>} expandTask - Expand task into subtasks
 * @property {string} projectRoot - Project root directory path
 */

/**
 * Logger Service Interface
 * @typedef {Object} LoggerService
 * @property {function(string, ...any): void} info - Log info message
 * @property {function(string, ...any): void} warn - Log warning message
 * @property {function(string, ...any): void} error - Log error message
 * @property {function(string, ...any): void} debug - Log debug message
 * @property {function(string, ...any): void} success - Log success message
 * @property {function(Object): LoggerService} child - Create child logger
 */

/**
 * Configuration Manager Interface
 * @typedef {Object} ConfigManagerService
 * @property {function(): Promise<Object>} load - Load configuration
 * @property {function(Object): Promise<void>} save - Save configuration
 * @property {function(string): any} get - Get config value by path
 * @property {function(string, any): void} set - Set config value by path
 * @property {function(): Object} getAll - Get all configuration
 * @property {function(Object): boolean} validate - Validate configuration
 */

/**
 * Branch Manager Interface
 * @typedef {Object} BranchManagerService
 * @property {function(): Promise<string>} getCurrentBranch - Get current git branch
 * @property {function(): Promise<boolean>} hasUncommittedChanges - Check for uncommitted changes
 * @property {function(): Promise<Object>} getStatus - Get git status
 * @property {function(string): Promise<void>} checkout - Checkout branch
 * @property {function(): void} startWatching - Start watching for branch changes
 * @property {function(): void} stopWatching - Stop watching for branch changes
 */

/**
 * Hook Manager Interface
 * @typedef {Object} HookManagerService
 * @property {function(string, function): void} register - Register hook
 * @property {function(string, ...any): Promise<any>} execute - Execute hook
 * @property {function(string): Array<function>} getHooks - Get hooks by name
 * @property {function(string, function): void} unregister - Unregister hook
 * @property {function(): Array<string>} listHooks - List all hook names
 */

/**
 * Provider Registry Interface
 * @typedef {Object} ProviderRegistryService
 * @property {function(string, Object): void} register - Register provider
 * @property {function(string): Object} get - Get provider by name
 * @property {function(): Array<string>} list - List all provider names
 * @property {function(string): boolean} has - Check if provider exists
 * @property {function(string): void} unregister - Unregister provider
 */

export const ServiceInterfaces = {
  /**
   * Backend Service Interface
   * Handles all task-related operations
   */
  Backend: {
    // Task operations
    getTasks: 'function',
    getTask: 'function',
    setTaskStatus: 'function',
    addTask: 'function',
    updateTask: 'function',
    removeTask: 'function',
    
    // Subtask operations
    addSubtask: 'function',
    updateSubtask: 'function',
    removeSubtask: 'function',
    
    // Tag operations
    getTags: 'function',
    addTag: 'function',
    deleteTag: 'function',
    useTag: 'function',
    
    // PRD and complexity
    parsePRD: 'function',
    analyzeComplexity: 'function',
    expandTask: 'function',
    getComplexityReport: 'function',
    
    // Properties
    projectRoot: 'string'
  },
  
  /**
   * Logger Service Interface
   * Provides structured logging capabilities
   */
  Logger: {
    info: 'function',
    warn: 'function',
    error: 'function',
    debug: 'function',
    success: 'function',
    child: 'function'
  },
  
  /**
   * Configuration Manager Interface
   * Manages application configuration
   */
  ConfigManager: {
    load: 'function',
    save: 'function',
    get: 'function',
    set: 'function',
    getAll: 'function',
    validate: 'function'
  },
  
  /**
   * AST Configuration Manager Interface
   * Manages AST-specific configuration
   */
  ASTConfigManager: {
    load: 'function',
    save: 'function',
    get: 'function',
    set: 'function',
    getAll: 'function',
    validate: 'function'
  },
  
  /**
   * Branch Manager Interface
   * Manages git branch awareness
   */
  BranchManager: {
    getCurrentBranch: 'function',
    hasUncommittedChanges: 'function',
    getStatus: 'function',
    checkout: 'function',
    startWatching: 'function',
    stopWatching: 'function'
  },
  
  /**
   * Hook Manager Interface
   * Manages application lifecycle hooks
   */
  HookManager: {
    register: 'function',
    execute: 'function',
    getHooks: 'function',
    unregister: 'function',
    listHooks: 'function'
  },
  
  /**
   * Provider Registry Interface
   * Manages AI/service providers
   */
  ProviderRegistry: {
    register: 'function',
    get: 'function',
    list: 'function',
    has: 'function',
    unregister: 'function'
  }
};

/**
 * Validate a service against its interface
 * @param {Object} service - The service to validate
 * @param {Object} serviceInterface - The interface to validate against
 * @param {string} serviceName - Name of the service for error messages
 * @throws {Error} If service doesn't match interface
 */
export function validateService(service, serviceInterface, serviceName) {
  if (!service) {
    throw new Error(`Service '${serviceName}' is null or undefined`);
  }
  
  for (const [property, expectedType] of Object.entries(serviceInterface)) {
    const actualType = typeof service[property];
    
    if (actualType === 'undefined') {
      throw new Error(`Service '${serviceName}' missing required property: ${property}`);
    }
    
    if (actualType !== expectedType) {
      throw new Error(
        `Service '${serviceName}' property '${property}' has wrong type. ` +
        `Expected ${expectedType}, got ${actualType}`
      );
    }
  }
}

/**
 * Validate all services in a service container
 * @param {Object} services - Container with all services
 * @throws {Error} If any service doesn't match its interface
 */
export function validateServices(services) {
  const validations = [
    ['backend', ServiceInterfaces.Backend],
    ['logger', ServiceInterfaces.Logger],
    ['configManager', ServiceInterfaces.ConfigManager],
    ['astConfigManager', ServiceInterfaces.ASTConfigManager],
    ['branchManager', ServiceInterfaces.BranchManager],
    ['hookManager', ServiceInterfaces.HookManager],
    ['providerRegistry', ServiceInterfaces.ProviderRegistry]
  ];
  
  for (const [serviceName, serviceInterface] of validations) {
    if (services[serviceName]) {
      validateService(services[serviceName], serviceInterface, serviceName);
    }
  }
}

/**
 * Create a type-safe service getter
 * @template T
 * @param {Object} services - Service container
 * @param {string} serviceName - Name of service to get
 * @returns {T} The requested service
 */
export function getService(services, serviceName) {
  const service = services[serviceName];
  if (!service) {
    throw new Error(`Service '${serviceName}' not found in container`);
  }
  return service;
}

/**
 * Create a mock service for testing
 * @param {Object} serviceInterface - Interface to mock
 * @param {Object} [overrides={}] - Custom implementations
 * @returns {Object} Mock service
 */
export function createMockService(serviceInterface, overrides = {}) {
  const mock = {};
  
  for (const [property, type] of Object.entries(serviceInterface)) {
    if (overrides[property]) {
      mock[property] = overrides[property];
    } else if (type === 'function') {
      mock[property] = jest.fn();
    } else if (type === 'string') {
      mock[property] = `mock-${property}`;
    } else if (type === 'number') {
      mock[property] = 0;
    } else if (type === 'boolean') {
      mock[property] = false;
    } else if (type === 'object') {
      mock[property] = {};
    }
  }
  
  return mock;
} 