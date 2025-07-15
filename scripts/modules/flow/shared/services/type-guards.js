/**
 * Type Guards for Service Validation
 * Runtime type checking utilities for services
 */

/**
 * Check if a value is a valid Task object
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a valid Task
 */
export function isTask(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'string' &&
    ['pending', 'in-progress', 'done', 'review', 'deferred', 'cancelled'].includes(value.status)
  );
}

/**
 * Check if a value is a valid Tag object
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a valid Tag
 */
export function isTag(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.name === 'string' &&
    typeof value.taskCount === 'number'
  );
}

/**
 * Check if a value is a valid BackendService
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a valid BackendService
 */
export function isBackendService(value) {
  if (!value || typeof value !== 'object') return false;
  
  const requiredMethods = [
    'getTasks', 'getTask', 'setTaskStatus', 'addTask', 'updateTask',
    'removeTask', 'addSubtask', 'updateSubtask', 'removeSubtask',
    'getTags', 'addTag', 'deleteTag', 'useTag', 'parsePRD',
    'analyzeComplexity', 'expandTask'
  ];
  
  return requiredMethods.every(method => typeof value[method] === 'function');
}

/**
 * Check if a value is a valid LoggerService
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a valid LoggerService
 */
export function isLoggerService(value) {
  if (!value || typeof value !== 'object') return false;
  
  const requiredMethods = ['info', 'warn', 'error', 'debug', 'success'];
  
  return requiredMethods.every(method => typeof value[method] === 'function');
}

/**
 * Check if a value is a valid ConfigManagerService
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a valid ConfigManagerService
 */
export function isConfigManagerService(value) {
  if (!value || typeof value !== 'object') return false;
  
  const requiredMethods = ['load', 'save', 'get', 'set', 'getAll', 'validate'];
  
  return requiredMethods.every(method => typeof value[method] === 'function');
}

/**
 * Check if a value is a valid BranchManagerService
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a valid BranchManagerService
 */
export function isBranchManagerService(value) {
  if (!value || typeof value !== 'object') return false;
  
  const requiredMethods = [
    'getCurrentBranch', 'hasUncommittedChanges', 'getStatus',
    'checkout', 'startWatching', 'stopWatching'
  ];
  
  return requiredMethods.every(method => typeof value[method] === 'function');
}

/**
 * Check if a value is a valid HookManagerService
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a valid HookManagerService
 */
export function isHookManagerService(value) {
  if (!value || typeof value !== 'object') return false;
  
  const requiredMethods = ['register', 'execute', 'getHooks', 'unregister', 'listHooks'];
  
  return requiredMethods.every(method => typeof value[method] === 'function');
}

/**
 * Check if a value is a valid ProviderRegistryService
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a valid ProviderRegistryService
 */
export function isProviderRegistryService(value) {
  if (!value || typeof value !== 'object') return false;
  
  const requiredMethods = ['register', 'get', 'list', 'has', 'unregister'];
  
  return requiredMethods.every(method => typeof value[method] === 'function');
}

/**
 * Assert that a value is a valid service type
 * @template T
 * @param {any} value - Value to check
 * @param {function(any): boolean} typeGuard - Type guard function
 * @param {string} serviceName - Service name for error message
 * @returns {T} The validated value
 * @throws {TypeError} If value fails type check
 */
export function assertService(value, typeGuard, serviceName) {
  if (!typeGuard(value)) {
    throw new TypeError(`Invalid ${serviceName} service: required methods missing`);
  }
  return value;
}

/**
 * Create a typed service container
 * @param {Object} services - Raw service container
 * @returns {Object} Typed service container
 */
export function createTypedServiceContainer(services) {
  return {
    backend: assertService(services.backend, isBackendService, 'Backend'),
    logger: assertService(services.logger, isLoggerService, 'Logger'),
    configManager: assertService(services.configManager, isConfigManagerService, 'ConfigManager'),
    astConfigManager: assertService(services.astConfigManager, isConfigManagerService, 'ASTConfigManager'),
    branchManager: assertService(services.branchManager, isBranchManagerService, 'BranchManager'),
    hookManager: assertService(services.hookManager, isHookManagerService, 'HookManager'),
    providerRegistry: assertService(services.providerRegistry, isProviderRegistryService, 'ProviderRegistry'),
    projectRoot: services.projectRoot
  };
} 