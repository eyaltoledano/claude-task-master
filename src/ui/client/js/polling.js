/**
 * PollingManager - Manages periodic data fetching with intelligent diff detection
 * Implements singleton pattern to ensure only one polling instance exists
 * 
 * @module PollingManager
 */

class PollingManager {
    static instance = null;
    
    /**
     * Private constructor - use getInstance() instead
     */
    constructor() {
        if (PollingManager.instance) {
            throw new Error('Use PollingManager.getInstance() to get the singleton instance');
        }
    }
    
    /**
     * Get the singleton instance of PollingManager
     * @param {Object} config - Configuration options
     * @param {number} config.interval - Polling interval in milliseconds (default: 30000)
     * @param {string} config.endpoint - API endpoint to poll (default: '/api/tasks')
     * @param {boolean} config.enableDiffDetection - Enable intelligent diff detection (default: true)
     * @param {boolean} config.enableCaching - Enable response caching (default: true)
     * @param {number} config.maxRetries - Maximum retry attempts (default: 3)
     * @param {number} config.backoffMultiplier - Exponential backoff multiplier (default: 2)
     * @param {number} config.maxBackoffDelay - Maximum backoff delay in ms (default: 32000)
     * @returns {PollingManager} The singleton instance
     */
    static getInstance(config = {}) {
        if (!PollingManager.instance) {
            PollingManager.instance = new PollingManager();
            PollingManager.instance.init(config);
        } else if (config && Object.keys(config).length > 0) {
            // Update configuration if provided
            PollingManager.instance.updateConfig(config);
        }
        return PollingManager.instance;
    }
    
    /**
     * Initialize the polling manager
     * @private
     */
    init(config) {
        // Default configuration
        this.config = {
            interval: 30000, // 30 seconds
            endpoint: '/api/tasks',
            enableDiffDetection: true,
            enableCaching: true,
            maxRetries: 3,
            backoffMultiplier: 2,
            maxBackoffDelay: 32000,
            ...config
        };
        
        // Validate configuration
        this.validateConfig();
        
        // State management
        this.isPolling = false;
        this.isPaused = false;
        this.pollTimer = null;
        this.retryCount = 0;
        this.retryDelay = 2000; // Initial retry delay
        
        // Data management
        this.lastData = null;
        this.lastFetchTime = null;
        this.lastHash = null;
        
        // Event emitter
        this.events = {};
        
        // Bind methods
        this.poll = this.poll.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        
        // Listen for visibility changes to pause/resume polling
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Track network status
        this.isOnline = navigator.onLine;
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.emit('network:online');
            if (this.isPolling && !this.isPaused) {
                this.refresh();
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.emit('network:offline');
        });
    }
    
    /**
     * Validate configuration values
     * @private
     */
    validateConfig() {
        if (this.config.interval <= 0) {
            throw new Error('Interval must be positive');
        }
        if (this.config.maxRetries < 1) {
            throw new Error('Max retries must be at least 1');
        }
        if (this.config.backoffMultiplier <= 1) {
            throw new Error('Backoff multiplier must be greater than 1');
        }
    }
    
    /**
     * Update configuration
     * @param {Object} config - New configuration options
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.validateConfig();
        
        // If polling is active, restart with new interval
        if (this.isPolling) {
            this.stop();
            this.start();
        }
    }
    
    /**
     * Start polling
     * @returns {Promise<void>}
     */
    async start() {
        if (this.isPolling) {
            console.log('Polling already started');
            return;
        }
        
        this.isPolling = true;
        this.retryCount = 0;
        this.emit('polling:start');
        
        // Perform initial poll
        await this.poll();
    }
    
    /**
     * Stop polling
     */
    stop() {
        if (!this.isPolling) {
            return;
        }
        
        this.isPolling = false;
        
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        
        this.emit('polling:stop');
    }
    
    /**
     * Pause polling temporarily
     */
    pause() {
        if (!this.isPolling || this.isPaused) {
            return;
        }
        
        this.isPaused = true;
        
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        
        this.emit('polling:pause');
    }
    
    /**
     * Resume paused polling
     */
    resume() {
        if (!this.isPolling || !this.isPaused) {
            return;
        }
        
        this.isPaused = false;
        this.emit('polling:resume');
        
        // Resume polling
        this.scheduleNextPoll();
    }
    
    /**
     * Perform a single poll
     * @returns {Promise<void>}
     */
    async poll() {
        if (!this.isPolling || this.isPaused) {
            return;
        }
        
        // Skip if offline
        if (!this.isOnline) {
            console.log('Skipping poll - offline');
            this.scheduleNextPoll();
            return;
        }
        
        try {
            this.emit('poll:start');
            
            // Fetch data
            const response = await fetch(this.config.endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Check if data has changed (if diff detection is enabled)
            let hasChanges = true;
            if (this.config.enableDiffDetection && this.lastData) {
                hasChanges = this.detectChanges(this.lastData, data);
            }
            
            // Store data
            this.lastData = data;
            this.lastFetchTime = Date.now();
            this.lastHash = this.hashData(data);
            
            // Reset retry count on success
            this.retryCount = 0;
            this.retryDelay = 2000;
            
            // Emit events
            this.emit('poll:success', data);
            this.emit('data', data);
            
            if (hasChanges) {
                this.emit('data:changed', data);
            } else {
                this.emit('data:unchanged', data);
            }
            
            // Schedule next poll
            this.scheduleNextPoll();
            
        } catch (error) {
            console.error('Polling error:', error);
            this.handlePollError(error);
        }
    }
    
    /**
     * Handle polling errors with exponential backoff
     * @private
     */
    handlePollError(error) {
        this.retryCount++;
        this.emit('poll:error', error);
        
        if (this.retryCount >= this.config.maxRetries) {
            console.error(`Max retries (${this.config.maxRetries}) reached, stopping polling`);
            this.emit('poll:maxRetries', error);
            this.stop();
            return;
        }
        
        // Calculate exponential backoff
        this.retryDelay = Math.min(
            this.retryDelay * this.config.backoffMultiplier,
            this.config.maxBackoffDelay
        );
        
        console.log(`Retrying in ${this.retryDelay}ms (attempt ${this.retryCount}/${this.config.maxRetries})`);
        
        // Schedule retry with backoff
        if (this.isPolling && !this.isPaused) {
            this.pollTimer = setTimeout(this.poll, this.retryDelay);
        }
    }
    
    /**
     * Schedule the next poll
     * @private
     */
    scheduleNextPoll() {
        if (!this.isPolling || this.isPaused) {
            return;
        }
        
        // Clear any existing timer
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
        }
        
        // Schedule next poll at regular interval
        this.pollTimer = setTimeout(this.poll, this.config.interval);
    }
    
    /**
     * Trigger an immediate refresh
     * @returns {Promise<void>}
     */
    async refresh() {
        if (!this.isPolling) {
            console.warn('Cannot refresh - polling not started');
            return;
        }
        
        // Clear existing timer
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        
        // Perform immediate poll
        await this.poll();
    }
    
    /**
     * Detect changes between old and new data
     * @param {Object} oldData - Previous data
     * @param {Object} newData - New data
     * @returns {boolean} True if changes detected
     * @private
     */
    detectChanges(oldData, newData) {
        // Quick hash comparison
        const oldHash = this.hashData(oldData);
        const newHash = this.hashData(newData);
        
        if (oldHash !== newHash) {
            // Detailed change detection can be implemented here
            // For now, we just detect any change
            return true;
        }
        
        return false;
    }
    
    /**
     * Generate a hash of the data for quick comparison
     * @param {Object} data - Data to hash
     * @returns {string} Hash string
     * @private
     */
    hashData(data) {
        // Simple JSON stringify hash
        // In production, consider using a proper hash function
        const str = JSON.stringify(data);
        let hash = 0;
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return hash.toString(36);
    }
    
    /**
     * Handle document visibility changes
     * @private
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, pause polling
            if (this.isPolling && !this.isPaused) {
                this.pause();
                this._autoPaused = true;
            }
        } else {
            // Page is visible, resume if auto-paused
            if (this._autoPaused) {
                this.resume();
                this._autoPaused = false;
                
                // Trigger immediate refresh when returning to page
                this.refresh();
            }
        }
    }
    
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    on(event, handler) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(handler);
    }
    
    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    once(event, handler) {
        const wrapper = (...args) => {
            handler(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} handler - Event handler to remove
     */
    off(event, handler) {
        if (!this.events[event]) {
            return;
        }
        
        this.events[event] = this.events[event].filter(h => h !== handler);
    }
    
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...any} args - Event arguments
     * @private
     */
    emit(event, ...args) {
        if (!this.events[event]) {
            return;
        }
        
        this.events[event].forEach(handler => {
            try {
                handler(...args);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }
    
    /**
     * Get current polling status
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            isPolling: this.isPolling,
            isPaused: this.isPaused,
            isOnline: this.isOnline,
            retryCount: this.retryCount,
            lastFetchTime: this.lastFetchTime,
            config: { ...this.config }
        };
    }
    
    /**
     * Destroy the polling manager and clean up
     */
    destroy() {
        this.stop();
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Clear all event handlers
        this.events = {};
        
        // Clear cached data
        this.lastData = null;
        this.lastHash = null;
        
        // Reset singleton instance
        PollingManager.instance = null;
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.PollingManager = PollingManager;
}

// Export for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PollingManager;
}