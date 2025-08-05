/**
 * Enhanced API Client with retry logic and request queuing
 * Implements exponential backoff and manages request ordering
 * 
 * @module APIClient
 */

class APIClient {
    /**
     * Create an API client instance
     * @param {Object} options - Configuration options
     * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
     * @param {number} options.retryDelay - Initial retry delay in ms (default: 1000)
     * @param {number} options.backoffMultiplier - Exponential backoff multiplier (default: 2)
     * @param {number} options.maxDelay - Maximum retry delay in ms (default: 10000)
     * @param {number} options.timeout - Request timeout in ms (default: 30000)
     * @param {boolean} options.enableQueuing - Enable request queuing (default: true)
     */
    constructor(options = {}) {
        this.options = {
            maxRetries: 3,
            retryDelay: 1000,
            backoffMultiplier: 2,
            maxDelay: 10000,
            timeout: 30000,
            enableQueuing: true,
            ...options
        };
        
        // Request queue management
        this.requestQueue = [];
        this.isProcessing = false;
        this.activeRequests = new Map();
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            queuedRequests: 0
        };
        
        // Error classification
        this.errorTypes = {
            NETWORK: 'network',
            SERVER: 'server',
            CLIENT: 'client',
            TIMEOUT: 'timeout',
            CANCELLED: 'cancelled'
        };
        
        // Bind methods
        this.processQueue = this.processQueue.bind(this);
    }
    
    /**
     * Update task status with retry logic and queuing
     * @param {string} taskId - Task ID
     * @param {string} newStatus - New status
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Response data
     */
    async updateTaskStatus(taskId, newStatus, options = {}) {
        const request = {
            id: `req-${Date.now()}-${Math.random()}`,
            type: 'updateStatus',
            taskId,
            newStatus,
            options,
            timestamp: Date.now(),
            retryCount: 0,
            deferred: this.createDeferred()
        };
        
        // Check if queuing is enabled and if there's an active request for this task
        if (this.options.enableQueuing) {
            // Check for duplicate requests in queue
            const existingRequest = this.findDuplicateRequest(request);
            if (existingRequest) {
                console.log(`Coalescing request for task ${taskId}`);
                return existingRequest.deferred.promise;
            }
            
            // Add to queue
            this.requestQueue.push(request);
            this.stats.queuedRequests++;
            
            // Process queue
            this.processQueue();
            
            return request.deferred.promise;
        } else {
            // Execute immediately without queuing
            return this.executeRequest(request);
        }
    }
    
    /**
     * Process the request queue
     * @private
     */
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            
            try {
                const result = await this.executeRequest(request);
                request.deferred.resolve(result);
            } catch (error) {
                request.deferred.reject(error);
            }
        }
        
        this.isProcessing = false;
    }
    
    /**
     * Execute a request with retry logic
     * @private
     */
    async executeRequest(request) {
        this.stats.totalRequests++;
        
        let lastError;
        let delay = this.options.retryDelay;
        
        for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
            try {
                // Log attempt
                if (attempt > 0) {
                    console.log(`Retry attempt ${attempt}/${this.options.maxRetries} for task ${request.taskId}`);
                    this.stats.retriedRequests++;
                }
                
                // Execute the actual API call
                const result = await this.makeAPICall(request);
                
                // Success!
                this.stats.successfulRequests++;
                this.activeRequests.delete(request.taskId);
                
                return result;
                
            } catch (error) {
                lastError = error;
                const errorType = this.classifyError(error);
                
                console.error(`Request failed (attempt ${attempt + 1}):`, error);
                
                // Check if error is retryable
                if (!this.isRetryableError(errorType) || attempt === this.options.maxRetries) {
                    // Not retryable or max retries reached
                    this.stats.failedRequests++;
                    this.activeRequests.delete(request.taskId);
                    
                    throw this.enhanceError(error, {
                        attempt: attempt + 1,
                        maxRetries: this.options.maxRetries,
                        errorType,
                        requestId: request.id
                    });
                }
                
                // Wait before retry with exponential backoff
                await this.wait(delay);
                
                // Increase delay for next retry
                delay = Math.min(delay * this.options.backoffMultiplier, this.options.maxDelay);
                request.retryCount++;
            }
        }
        
        // Should not reach here, but just in case
        throw lastError;
    }
    
    /**
     * Make the actual API call
     * @private
     */
    async makeAPICall(request) {
        const { taskId, newStatus } = request;
        
        // Mark as active
        this.activeRequests.set(taskId, request);
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
        
        try {
            const response = await fetch(`/api/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ status: newStatus }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await this.parseErrorResponse(response);
                throw new APIError(
                    errorData.message || `HTTP ${response.status}`,
                    response.status,
                    errorData
                );
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new APIError('Request timeout', 408, { timeout: this.options.timeout });
            }
            
            throw error;
        }
    }
    
    /**
     * Parse error response
     * @private
     */
    async parseErrorResponse(response) {
        try {
            return await response.json();
        } catch {
            return { 
                message: response.statusText,
                status: response.status
            };
        }
    }
    
    /**
     * Classify error type
     * @private
     */
    classifyError(error) {
        if (error.name === 'AbortError' || error.status === 408) {
            return this.errorTypes.TIMEOUT;
        }
        
        if (error.status >= 500) {
            return this.errorTypes.SERVER;
        }
        
        if (error.status >= 400 && error.status < 500) {
            return this.errorTypes.CLIENT;
        }
        
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
            return this.errorTypes.NETWORK;
        }
        
        return this.errorTypes.NETWORK; // Default to network error
    }
    
    /**
     * Check if error is retryable
     * @private
     */
    isRetryableError(errorType) {
        // Retry on network errors, timeouts, and server errors
        return [
            this.errorTypes.NETWORK,
            this.errorTypes.TIMEOUT,
            this.errorTypes.SERVER
        ].includes(errorType);
    }
    
    /**
     * Enhance error with additional context
     * @private
     */
    enhanceError(error, context) {
        const enhanced = new Error(error.message);
        enhanced.name = error.name || 'APIError';
        enhanced.status = error.status;
        enhanced.context = context;
        enhanced.originalError = error;
        
        // Add retry information to message
        if (context.attempt > 1) {
            enhanced.message += ` (failed after ${context.attempt} attempts)`;
        }
        
        return enhanced;
    }
    
    /**
     * Find duplicate request in queue
     * @private
     */
    findDuplicateRequest(request) {
        return this.requestQueue.find(r => 
            r.taskId === request.taskId &&
            r.type === request.type &&
            r.newStatus === request.newStatus &&
            Date.now() - r.timestamp < 1000 // Within 1 second
        );
    }
    
    /**
     * Create a deferred promise
     * @private
     */
    createDeferred() {
        const deferred = {};
        
        deferred.promise = new Promise((resolve, reject) => {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });
        
        return deferred;
    }
    
    /**
     * Wait for specified duration
     * @private
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Cancel a pending request
     * @param {string} taskId - Task ID
     * @returns {boolean} True if request was cancelled
     */
    cancelRequest(taskId) {
        // Check active requests
        if (this.activeRequests.has(taskId)) {
            const request = this.activeRequests.get(taskId);
            request.cancelled = true;
            this.activeRequests.delete(taskId);
            return true;
        }
        
        // Check queue
        const index = this.requestQueue.findIndex(r => r.taskId === taskId);
        if (index !== -1) {
            const request = this.requestQueue[index];
            this.requestQueue.splice(index, 1);
            
            request.deferred.reject(new Error('Request cancelled'));
            return true;
        }
        
        return false;
    }
    
    /**
     * Cancel all pending requests
     */
    cancelAll() {
        // Cancel queued requests
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            request.deferred.reject(new Error('Request cancelled'));
        }
        
        // Clear active requests
        this.activeRequests.clear();
        this.isProcessing = false;
    }
    
    /**
     * Get queue status
     * @returns {Object} Queue status
     */
    getQueueStatus() {
        return {
            queueLength: this.requestQueue.length,
            activeRequests: this.activeRequests.size,
            isProcessing: this.isProcessing,
            stats: { ...this.stats }
        };
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            queuedRequests: 0
        };
    }
    
    /**
     * Update configuration
     * @param {Object} options - New configuration options
     */
    updateConfig(options) {
        this.options = { ...this.options, ...options };
    }
    
    /**
     * Batch update multiple task statuses
     * @param {Array} updates - Array of {taskId, newStatus} objects
     * @returns {Promise<Array>} Array of results
     */
    async batchUpdateStatus(updates) {
        const promises = updates.map(update => 
            this.updateTaskStatus(update.taskId, update.newStatus, update.options)
        );
        
        // Use Promise.allSettled to handle partial failures
        const results = await Promise.allSettled(promises);
        
        return results.map((result, index) => ({
            taskId: updates[index].taskId,
            success: result.status === 'fulfilled',
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    }
}

/**
 * Custom API Error class
 */
class APIError extends Error {
    constructor(message, status = 500, details = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.details = details;
        this.timestamp = Date.now();
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.APIClient = APIClient;
    window.APIError = APIError;
}

// Export for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIClient, APIError };
}