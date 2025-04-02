/**
 * Service Interface
 * 
 * Defines the contract all application services must implement
 * Provides a consistent structure for services
 */

import errorHandler from '../error-handler.js';

/**
 * Base Service interface
 * All application services should extend this interface
 */
export class ServiceInterface {
  /**
   * Create a new service instance
   * @param {object} dependencies - Service dependencies
   * @param {object} config - Service configuration
   * @throws {Error} - If directly instantiated
   */
  constructor(dependencies = {}, config = {}) {
    if (this.constructor === ServiceInterface) {
      throw errorHandler.create('ServiceInterface cannot be instantiated directly', {
        name: 'InterfaceError',
        code: 'ERR_ABSTRACT_CLASS',
        category: 'system'
      });
    }
    
    this.dependencies = dependencies;
    this.config = config;
    this.initialized = false;
    this.eventListeners = new Map();
  }

  /**
   * Initialize the service with configuration and dependencies
   * Must be called before any other methods
   * @returns {Promise<void>}
   * @throws {Error} - If not implemented
   */
  async initialize() {
    throw errorHandler.create('Method not implemented: initialize()', {
      name: 'NotImplementedError',
      code: 'ERR_NOT_IMPLEMENTED',
      category: 'system'
    });
  }

  /**
   * Get service information
   * @returns {object} - Service info with name, version, etc.
   * @throws {Error} - If not implemented
   */
  getServiceInfo() {
    throw errorHandler.create('Method not implemented: getServiceInfo()', {
      name: 'NotImplementedError',
      code: 'ERR_NOT_IMPLEMENTED',
      category: 'system'
    });
  }

  /**
   * Get service capabilities
   * @returns {object} - Service capabilities
   */
  getCapabilities() {
    // Default implementation - can be overridden
    return {
      supportsEvents: this.supportsEvents(),
      features: []
    };
  }

  /**
   * Check if service is initialized
   * @returns {boolean} - Whether the service is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Check if service supports events
   * @returns {boolean} - Whether the service supports events
   */
  supportsEvents() {
    return this.eventListeners.size > 0;
  }

  /**
   * Register an event listener
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Event listener function
   * @returns {boolean} - Whether the listener was registered
   */
  on(eventName, listener) {
    if (typeof listener !== 'function') {
      throw errorHandler.createValidationError('Event listener must be a function');
    }
    
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    
    this.eventListeners.get(eventName).add(listener);
    return true;
  }

  /**
   * Remove an event listener
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Event listener function
   * @returns {boolean} - Whether the listener was removed
   */
  off(eventName, listener) {
    if (!this.eventListeners.has(eventName)) {
      return false;
    }
    
    const listeners = this.eventListeners.get(eventName);
    const result = listeners.delete(listener);
    
    if (listeners.size === 0) {
      this.eventListeners.delete(eventName);
    }
    
    return result;
  }

  /**
   * Emit an event to all registered listeners
   * @param {string} eventName - Name of the event
   * @param {any} data - Event data
   * @returns {Promise<boolean>} - Whether the event had listeners
   * @protected
   */
  async _emit(eventName, data) {
    if (!this.eventListeners.has(eventName)) {
      return false;
    }
    
    const listeners = Array.from(this.eventListeners.get(eventName));
    
    for (const listener of listeners) {
      try {
        await listener(data, eventName, this);
      } catch (error) {
        errorHandler.handle(error, {
          message: `Error in event listener for ${eventName}`,
          category: 'system'
        });
      }
    }
    
    return listeners.length > 0;
  }

  /**
   * Validate service dependencies
   * @param {object} dependencies - Dependencies to validate
   * @returns {object} - Validated dependencies
   * @throws {Error} - If dependencies are invalid
   * @protected
   */
  _validateDependencies(dependencies) {
    // Default implementation to be overridden
    return dependencies;
  }

  /**
   * Validate service configuration
   * @param {object} config - Configuration to validate
   * @returns {object} - Validated configuration
   * @throws {Error} - If configuration is invalid
   * @protected
   */
  _validateConfig(config) {
    // Default implementation to be overridden
    return config;
  }

  /**
   * Cleanup resources used by this service
   * Called during shutdown
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Default implementation - can be overridden
    this.eventListeners.clear();
    this.initialized = false;
  }
} 