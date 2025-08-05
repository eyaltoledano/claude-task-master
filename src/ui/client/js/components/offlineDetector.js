/**
 * Offline Mode Detection System
 * Monitors network connectivity and provides offline handling capabilities
 * 
 * @module OfflineDetector
 */

class OfflineDetector {
    /**
     * Create a new OfflineDetector instance
     * @param {Object} options - Configuration options
     * @param {number} options.checkInterval - Interval for connectivity checks in ms (default: 30000)
     * @param {Array} options.endpoints - Endpoints to check for connectivity
     * @param {boolean} options.showNotifications - Show toast notifications (default: true)
     * @param {boolean} options.showIndicator - Show visual indicator (default: true)
     * @param {boolean} options.enableQueue - Enable request queuing (default: true)
     * @param {boolean} options.persistState - Persist state in sessionStorage (default: false)
     */
    constructor(options = {}) {
        this.options = {
            checkInterval: 30000, // 30 seconds
            endpoints: ['/api/health', '/favicon.ico', 'https://1.1.1.1'],
            showNotifications: true,
            showIndicator: true,
            enableQueue: true,
            persistState: false,
            ...options
        };
        
        this.isOnline = navigator.onLine;
        this.checkIntervalId = null;
        this.requestQueue = [];
        this.listeners = new Map();
        this.lastOnlineTime = Date.now();
        
        // Restore state if persistence is enabled
        if (this.options.persistState && typeof window !== 'undefined') {
            const savedState = window.sessionStorage.getItem('offline-mode');
            if (savedState === 'true') {
                this.isOnline = false;
            }
        }
        
        // Bind event handlers
        this.handleOnline = this.handleOnline.bind(this);
        this.handleOffline = this.handleOffline.bind(this);
        this.checkConnectivity = this.checkConnectivity.bind(this);
    }
    
    /**
     * Start monitoring network connectivity
     */
    start() {
        // Add event listeners
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
        
        // Start periodic connectivity checks
        if (this.options.checkInterval > 0) {
            this.checkIntervalId = setInterval(this.checkConnectivity, this.options.checkInterval);
        }
        
        // Set initial state
        if (!this.isOnline) {
            this.setOfflineState();
        }
        
        // Emit initial status
        this.emit('status-change', {
            online: this.isOnline,
            timestamp: Date.now()
        });
    }
    
    /**
     * Stop monitoring network connectivity
     */
    stop() {
        // Remove event listeners
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        
        // Clear interval
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = null;
        }
        
        // Clear indicators
        this.hideIndicator();
        document.body.classList.remove('offline');
    }
    
    /**
     * Handle online event
     * @private
     */
    handleOnline() {
        if (!this.isOnline) {
            this.isOnline = true;
            this.lastOnlineTime = Date.now();
            this.setOnlineState();
            
            // Process queued requests
            if (this.options.enableQueue && this.requestQueue.length > 0) {
                this.processQueue();
            }
        }
    }
    
    /**
     * Handle offline event
     * @private
     */
    handleOffline() {
        if (this.isOnline) {
            this.isOnline = false;
            this.setOfflineState();
        }
    }
    
    /**
     * Check connectivity by trying to reach endpoints
     * @private
     */
    async checkConnectivity() {
        // Skip if already offline (browser reported)
        if (!navigator.onLine) {
            this.handleOffline();
            return;
        }
        
        // Try each endpoint
        for (const endpoint of this.options.endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'HEAD',
                    cache: 'no-cache',
                    mode: endpoint.startsWith('http') ? 'cors' : 'same-origin'
                });
                
                if (response.ok || response.status === 304) {
                    if (!this.isOnline) {
                        this.handleOnline();
                    }
                    return; // Successfully connected
                }
            } catch (error) {
                // Continue to next endpoint
            }
        }
        
        // All endpoints failed
        if (this.isOnline) {
            this.handleOffline();
        }
    }
    
    /**
     * Set offline state
     * @private
     */
    setOfflineState() {
        // Update UI
        document.body.classList.add('offline');
        
        if (this.options.showIndicator) {
            this.showIndicator();
        }
        
        // Show notification
        if (this.options.showNotifications) {
            const toastManager = this.getToastManager();
            if (toastManager) {
                toastManager.warning('You are currently offline', {
                    duration: 0,
                    actions: [{
                        label: 'Dismiss',
                        handler: () => {}
                    }]
                });
            }
        }
        
        // Persist state
        if (this.options.persistState && typeof window !== 'undefined') {
            window.sessionStorage.setItem('offline-mode', 'true');
        }
        
        // Emit events
        this.emit('offline');
        this.emit('status-change', {
            online: false,
            timestamp: Date.now()
        });
    }
    
    /**
     * Set online state
     * @private
     */
    setOnlineState() {
        // Update UI
        document.body.classList.remove('offline');
        
        if (this.options.showIndicator) {
            this.hideIndicator();
        }
        
        // Show notification
        if (this.options.showNotifications) {
            const toastManager = this.getToastManager();
            if (toastManager) {
                toastManager.success('You are back online', {
                    duration: 3000
                });
            }
        }
        
        // Persist state
        if (this.options.persistState && typeof window !== 'undefined') {
            window.sessionStorage.setItem('offline-mode', 'false');
        }
        
        // Emit events
        this.emit('online');
        this.emit('status-change', {
            online: true,
            timestamp: Date.now()
        });
    }
    
    /**
     * Show offline indicator
     * @private
     */
    showIndicator() {
        let indicator = document.querySelector('.offline-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'offline-indicator';
            indicator.innerHTML = `
                <span class="offline-icon">⚠</span>
                <span class="offline-text">You are offline</span>
            `;
            document.body.appendChild(indicator);
        }
        
        indicator.classList.add('offline-indicator-visible');
    }
    
    /**
     * Hide offline indicator
     * @private
     */
    hideIndicator() {
        const indicator = document.querySelector('.offline-indicator');
        if (indicator) {
            indicator.classList.remove('offline-indicator-visible');
        }
    }
    
    /**
     * Queue a request for later processing
     * @param {Object} request - Request to queue
     * @returns {number} Queue position
     */
    queueRequest(request) {
        if (!this.options.enableQueue) {
            throw new Error('Request queuing is disabled');
        }
        
        const queuedRequest = {
            ...request,
            id: Date.now() + Math.random(),
            timestamp: Date.now()
        };
        
        this.requestQueue.push(queuedRequest);
        this.emit('request-queued', queuedRequest);
        
        return this.requestQueue.length - 1;
    }
    
    /**
     * Get all queued requests
     * @returns {Array} Queued requests
     */
    getQueuedRequests() {
        return [...this.requestQueue];
    }
    
    /**
     * Process queued requests
     * @private
     */
    processQueue() {
        if (this.requestQueue.length === 0) return;
        
        const requests = [...this.requestQueue];
        this.clearQueue();
        
        this.emit('process-queue', requests);
    }
    
    /**
     * Clear the request queue
     */
    clearQueue() {
        this.requestQueue = [];
        this.emit('queue-cleared');
    }
    
    /**
     * Get toast manager instance
     * @private
     * @returns {Object|null} Toast manager
     */
    getToastManager() {
        return (typeof window !== 'undefined' && window.toast) || 
               (typeof global !== 'undefined' && global.toast);
    }
    
    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    /**
     * Emit an event
     * @private
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }
    
    /**
     * Get current online status
     * @returns {boolean} Online status
     */
    getStatus() {
        return this.isOnline;
    }
    
    /**
     * Get time since last online
     * @returns {number} Milliseconds since last online
     */
    getTimeSinceLastOnline() {
        return Date.now() - this.lastOnlineTime;
    }
}

// Create singleton instance for easy access
let offlineDetectorInstance = null;

/**
 * Get or create the global offline detector instance
 * @param {Object} options - Configuration options
 * @returns {OfflineDetector} Offline detector instance
 */
export function getOfflineDetector(options = {}) {
    if (!offlineDetectorInstance) {
        offlineDetectorInstance = new OfflineDetector(options);
    }
    return offlineDetectorInstance;
}

// Convenience methods for global instance
export const offlineDetector = {
    start: () => getOfflineDetector().start(),
    stop: () => getOfflineDetector().stop(),
    isOnline: () => getOfflineDetector().getStatus(),
    queueRequest: (request) => getOfflineDetector().queueRequest(request),
    getQueue: () => getOfflineDetector().getQueuedRequests(),
    clearQueue: () => getOfflineDetector().clearQueue(),
    on: (event, callback) => getOfflineDetector().on(event, callback),
    off: (event, callback) => getOfflineDetector().off(event, callback)
};

export default OfflineDetector;