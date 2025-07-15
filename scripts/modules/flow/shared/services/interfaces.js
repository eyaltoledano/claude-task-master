/**
 * Service Interfaces for Dependency Injection
 * Defines the expected shape of each service for documentation and validation
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
    
    // Dependencies
    addDependency: 'function',
    removeDependency: 'function',
    validateDependencies: 'function',
    
    // Utilities
    hasTasksFile: 'function',
    initialize: 'function'
  },
  
  /**
   * Logger Service Interface
   * Provides logging functionality across the application
   */
  Logger: {
    info: 'function',
    error: 'function',
    warn: 'function',
    debug: 'function',
    success: 'function',
    log: 'function'
  },
  
  /**
   * ConfigManager Service Interface
   * Manages application configuration
   */
  ConfigManager: {
    loadConfig: 'function',
    saveConfig: 'function',
    getVibeKitConfig: 'function',
    getFlowConfig: 'function',
    updateConfig: 'function',
    validateConfig: 'function'
  },
  
  /**
   * ASTConfigManager Service Interface
   * Manages AST-specific configuration
   */
  ASTConfigManager: {
    loadConfig: 'function',
    saveConfig: 'function',
    getASTConfig: 'function',
    updateASTConfig: 'function',
    validateASTConfig: 'function'
  },
  
  /**
   * BranchManager Service Interface
   * Manages git branch awareness and operations
   */
  BranchManager: {
    getCurrentBranchInfo: 'function',
    getRemoteInfo: 'function',
    switchBranch: 'function',
    createBranch: 'function',
    deleteBranch: 'function',
    getBranchList: 'function',
    repositoryName: 'string'
  },
  
  /**
   * HookManager Service Interface
   * Manages plugin/hook system
   */
  HookManager: {
    initialize: 'function',
    registerHook: 'function',
    unregisterHook: 'function',
    executeHooks: 'function',
    getHooks: 'function',
    hasHook: 'function'
  },
  
  /**
   * ProviderRegistry Service Interface
   * Manages AI/agent providers
   */
  ProviderRegistry: {
    getProvider: 'function',
    registerProvider: 'function',
    unregisterProvider: 'function',
    getProviders: 'function',
    hasProvider: 'function',
    selectAgent: 'function',
    getAgent: 'function'
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
 * @param {Object} services - The service container to validate
 * @throws {Error} If any service doesn't match its interface
 */
export function validateAllServices(services) {
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