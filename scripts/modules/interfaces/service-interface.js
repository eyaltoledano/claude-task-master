/**
 * ServiceInterface
 * Base class for all service implementations
 */

/**
 * Abstract base class for services
 * Provides common functionality and interface contract
 */
export class ServiceInterface {
  /**
   * Create a new service instance
   * @param {object} deps - Service dependencies (providers, etc.)
   * @param {object} config - Configuration options
   */
  constructor(deps = {}, config = {}) {
    this.initialized = false;
    this.config = config;
    this.deps = deps;
    
    // Store common config values
    this.debug = config.debug || false;
    this.logLevel = config.logLevel || 'info';
  }
  
  /**
   * Initialize the service
   * To be implemented by subclasses
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize() {
    this.initialized = true;
    return true;
  }
  
  /**
   * Cleanup service resources
   * To be implemented by subclasses
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.initialized = false;
  }
  
  /**
   * Check if service is initialized
   * @returns {boolean} - True if initialized
   */
  isInitialized() {
    return this.initialized;
  }
  
  /**
   * Get service name
   * @returns {string} - Service name
   */
  getName() {
    return this.constructor.name;
  }
  
  /**
   * Get service version
   * @returns {string} - Service version
   */
  getVersion() {
    return '1.0.0';
  }
  
  /**
   * Get service status
   * @returns {object} - Service status object
   */
  getStatus() {
    return {
      name: this.getName(),
      version: this.getVersion(),
      initialized: this.isInitialized(),
      config: this.config
    };
  }
} 