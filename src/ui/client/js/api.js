/**
 * TaskAPI - Handles all API communication for task management
 * Provides methods for CRUD operations and error handling
 */
class TaskAPI {
    static baseURL = '/api';
    static timeout = 30000; // 30 seconds
    
    /**
     * Make HTTP request with error handling and timeout
     */
    static async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        // Default options
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: this.timeout
        };

        // Merge options
        const requestOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        // Convert body to JSON if it's an object
        if (requestOptions.body && typeof requestOptions.body === 'object') {
            requestOptions.body = JSON.stringify(requestOptions.body);
        }

        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            requestOptions.signal = controller.signal;

            console.log(`API Request: ${requestOptions.method} ${url}`, requestOptions);

            const response = await fetch(url, requestOptions);
            clearTimeout(timeoutId);

            // Handle HTTP errors
            if (!response.ok) {
                const errorData = await this.parseErrorResponse(response);
                throw new APIError(
                    errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    errorData
                );
            }

            // Parse JSON response
            const data = await response.json();
            console.log(`API Response: ${requestOptions.method} ${url}`, data);
            
            return data;

        } catch (error) {
            console.error(`API Error: ${requestOptions.method} ${url}`, error);

            // Handle specific error types
            if (error.name === 'AbortError') {
                throw new APIError('Request timeout', 408);
            } else if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new APIError('Network error - please check your connection', 0);
            } else if (error instanceof APIError) {
                throw error;
            } else {
                throw new APIError('Unexpected error occurred', 500, { originalError: error.message });
            }
        }
    }

    /**
     * Parse error response body
     */
    static async parseErrorResponse(response) {
        try {
            return await response.json();
        } catch {
            return { message: response.statusText };
        }
    }

    /**
     * Get all tasks
     */
    static async getTasks(filters = {}) {
        const queryParams = new URLSearchParams();
        
        // Add filters as query parameters
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined && filters[key] !== null) {
                queryParams.append(key, filters[key]);
            }
        });

        const endpoint = '/tasks' + (queryParams.toString() ? `?${queryParams}` : '');
        
        try {
            const response = await this.request(endpoint);
            
            // Ensure response has expected structure
            if (!response.tasks || !Array.isArray(response.tasks)) {
                console.warn('Invalid tasks response structure, using empty array');
                return { tasks: [], total: 0 };
            }

            return response;
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
            
            // Return cached data or empty structure
            const cachedTasks = this.getCachedTasks();
            if (cachedTasks) {
                console.log('Using cached tasks due to API error');
                return { tasks: cachedTasks, total: cachedTasks.length, cached: true };
            }
            
            throw error;
        }
    }

    /**
     * Get a specific task by ID
     */
    static async getTask(taskId) {
        if (!taskId) {
            throw new APIError('Task ID is required', 400);
        }

        try {
            const response = await this.request(`/tasks/${taskId}`);
            
            if (!response.task) {
                throw new APIError('Task not found', 404);
            }

            return response;
        } catch (error) {
            console.error(`Failed to fetch task ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new task
     */
    static async createTask(taskData) {
        // Validate required fields
        if (!taskData.title || !taskData.title.trim()) {
            throw new APIError('Task title is required', 400);
        }

        // Prepare task data
        const task = {
            title: taskData.title.trim(),
            description: taskData.description?.trim() || '',
            status: taskData.status || 'backlog',
            priority: taskData.priority || 'medium',
            tags: taskData.tags || [],
            assignee: taskData.assignee || null,
            dueDate: taskData.dueDate || null,
            ...taskData
        };

        try {
            const response = await this.request('/tasks', {
                method: 'POST',
                body: task
            });

            // Cache the new task
            this.updateCachedTask(response.task);

            return response;
        } catch (error) {
            console.error('Failed to create task:', error);
            
            // If offline, create locally with temporary ID
            if (error.status === 0) {
                const localTask = {
                    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    ...task,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    isLocal: true
                };

                this.updateCachedTask(localTask);
                console.log('Created local task due to network error:', localTask);
                
                return { task: localTask, local: true };
            }
            
            throw error;
        }
    }

    /**
     * Update an existing task
     */
    static async updateTask(taskId, updates) {
        if (!taskId) {
            throw new APIError('Task ID is required', 400);
        }

        // Validate updates
        if (updates.title !== undefined && (!updates.title || !updates.title.trim())) {
            throw new APIError('Task title cannot be empty', 400);
        }

        // Prepare update data
        const updateData = {
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Clean up empty values
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === '' || updateData[key] === null) {
                delete updateData[key];
            }
        });

        try {
            const response = await this.request(`/tasks/${taskId}/status`, {
                method: 'POST',
                body: updateData
            });

            // Update cache
            this.updateCachedTask(response.task);

            return response;
        } catch (error) {
            console.error(`Failed to update task ${taskId}:`, error);
            
            // If offline, update locally
            if (error.status === 0) {
                const cachedTasks = this.getCachedTasks() || [];
                const taskIndex = cachedTasks.findIndex(t => t.id === taskId);
                
                if (taskIndex !== -1) {
                    const updatedTask = {
                        ...cachedTasks[taskIndex],
                        ...updateData,
                        isLocalUpdate: true
                    };
                    
                    cachedTasks[taskIndex] = updatedTask;
                    this.setCachedTasks(cachedTasks);
                    
                    console.log('Updated local task due to network error:', updatedTask);
                    return { task: updatedTask, local: true };
                }
            }
            
            throw error;
        }
    }

    /**
     * Delete a task
     */
    static async deleteTask(taskId) {
        if (!taskId) {
            throw new APIError('Task ID is required', 400);
        }

        try {
            const response = await this.request(`/tasks/${taskId}`, {
                method: 'DELETE'
            });

            // Remove from cache
            this.removeCachedTask(taskId);

            return response;
        } catch (error) {
            console.error(`Failed to delete task ${taskId}:`, error);
            
            // If offline, remove locally
            if (error.status === 0) {
                this.removeCachedTask(taskId);
                console.log('Removed local task due to network error:', taskId);
                return { success: true, local: true };
            }
            
            throw error;
        }
    }

    /**
     * Update task status (shorthand for common operation)
     */
    static async updateTaskStatus(taskId, status) {
        const validStatuses = ['backlog', 'ready', 'in-progress', 'review', 'done'];
        
        if (!validStatuses.includes(status)) {
            throw new APIError(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`, 400);
        }

        return this.updateTask(taskId, { status });
    }

    /**
     * Bulk update tasks
     */
    static async bulkUpdateTasks(updates) {
        if (!Array.isArray(updates) || updates.length === 0) {
            throw new APIError('Updates array is required', 400);
        }

        try {
            const response = await this.request('/tasks/bulk', {
                method: 'PUT',
                body: { updates }
            });

            // Update cache for all tasks
            if (response.tasks) {
                response.tasks.forEach(task => {
                    this.updateCachedTask(task);
                });
            }

            return response;
        } catch (error) {
            console.error('Failed to bulk update tasks:', error);
            
            // If offline, update locally
            if (error.status === 0) {
                const cachedTasks = this.getCachedTasks() || [];
                const updatedTasks = [];
                
                updates.forEach(update => {
                    const taskIndex = cachedTasks.findIndex(t => t.id === update.id);
                    if (taskIndex !== -1) {
                        const updatedTask = {
                            ...cachedTasks[taskIndex],
                            ...update.data,
                            updatedAt: new Date().toISOString(),
                            isLocalUpdate: true
                        };
                        
                        cachedTasks[taskIndex] = updatedTask;
                        updatedTasks.push(updatedTask);
                    }
                });
                
                this.setCachedTasks(cachedTasks);
                console.log('Bulk updated local tasks due to network error:', updatedTasks);
                
                return { tasks: updatedTasks, local: true };
            }
            
            throw error;
        }
    }

    /**
     * Search tasks
     */
    static async searchTasks(query, filters = {}) {
        if (!query || !query.trim()) {
            return this.getTasks(filters);
        }

        const queryParams = new URLSearchParams({
            q: query.trim(),
            ...filters
        });

        try {
            const response = await this.request(`/tasks/search?${queryParams}`);
            return response;
        } catch (error) {
            console.error('Failed to search tasks:', error);
            
            // Fallback to local search
            const cachedTasks = this.getCachedTasks() || [];
            const filteredTasks = this.searchTasksLocally(cachedTasks, query, filters);
            
            return { 
                tasks: filteredTasks, 
                total: filteredTasks.length, 
                local: true 
            };
        }
    }

    /**
     * Local search implementation
     */
    static searchTasksLocally(tasks, query, filters = {}) {
        const searchTerm = query.toLowerCase();
        
        return tasks.filter(task => {
            // Text search
            const matchesSearch = !query || 
                task.title.toLowerCase().includes(searchTerm) ||
                (task.description && task.description.toLowerCase().includes(searchTerm)) ||
                (task.tags && task.tags.some(tag => tag.toLowerCase().includes(searchTerm)));

            // Filter by status
            const matchesStatus = !filters.status || task.status === filters.status;
            
            // Filter by priority
            const matchesPriority = !filters.priority || task.priority === filters.priority;
            
            // Filter by assignee
            const matchesAssignee = !filters.assignee || task.assignee === filters.assignee;

            return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
        });
    }

    /**
     * Sync local changes with server
     */
    static async syncLocalChanges() {
        const cachedTasks = this.getCachedTasks() || [];
        const localTasks = cachedTasks.filter(task => task.isLocal || task.isLocalUpdate);
        
        if (localTasks.length === 0) {
            return { synced: 0, errors: [] };
        }

        const syncResults = {
            synced: 0,
            errors: []
        };

        console.log(`Syncing ${localTasks.length} local tasks...`);

        for (const task of localTasks) {
            try {
                if (task.isLocal) {
                    // Create new task on server
                    const { isLocal, id, ...taskData } = task;
                    const response = await this.createTask(taskData);
                    
                    // Replace local task with server task
                    this.replaceCachedTask(id, response.task);
                    syncResults.synced++;
                    
                } else if (task.isLocalUpdate) {
                    // Update existing task on server
                    const { isLocalUpdate, ...taskData } = task;
                    const response = await this.updateTask(task.id, taskData);
                    
                    // Update cached task
                    this.updateCachedTask(response.task);
                    syncResults.synced++;
                }
            } catch (error) {
                console.error(`Failed to sync task ${task.id}:`, error);
                syncResults.errors.push({
                    taskId: task.id,
                    error: error.message
                });
            }
        }

        console.log(`Sync completed: ${syncResults.synced} synced, ${syncResults.errors.length} errors`);
        return syncResults;
    }

    /**
     * Check API health
     */
    static async health() {
        try {
            const response = await this.request('/health');
            return response;
        } catch (error) {
            console.error('API health check failed:', error);
            return { status: 'error', error: error.message };
        }
    }

    // ========================================
    // Cache Management Methods
    // ========================================

    /**
     * Get cached tasks from localStorage
     */
    static getCachedTasks() {
        try {
            const cached = localStorage.getItem('kanban-api-cache');
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.warn('Failed to load cached tasks:', error);
            return null;
        }
    }

    /**
     * Set cached tasks in localStorage
     */
    static setCachedTasks(tasks) {
        try {
            localStorage.setItem('kanban-api-cache', JSON.stringify(tasks));
        } catch (error) {
            console.warn('Failed to cache tasks:', error);
        }
    }

    /**
     * Update a single cached task
     */
    static updateCachedTask(task) {
        const cachedTasks = this.getCachedTasks() || [];
        const existingIndex = cachedTasks.findIndex(t => t.id === task.id);
        
        if (existingIndex !== -1) {
            cachedTasks[existingIndex] = task;
        } else {
            cachedTasks.push(task);
        }
        
        this.setCachedTasks(cachedTasks);
    }

    /**
     * Remove a task from cache
     */
    static removeCachedTask(taskId) {
        const cachedTasks = this.getCachedTasks() || [];
        const filteredTasks = cachedTasks.filter(t => t.id !== taskId);
        this.setCachedTasks(filteredTasks);
    }

    /**
     * Replace a cached task (used when syncing local tasks)
     */
    static replaceCachedTask(oldId, newTask) {
        const cachedTasks = this.getCachedTasks() || [];
        const index = cachedTasks.findIndex(t => t.id === oldId);
        
        if (index !== -1) {
            cachedTasks[index] = newTask;
        } else {
            cachedTasks.push(newTask);
        }
        
        this.setCachedTasks(cachedTasks);
    }

    /**
     * Clear all cached data
     */
    static clearCache() {
        try {
            localStorage.removeItem('kanban-api-cache');
            console.log('Cache cleared');
        } catch (error) {
            console.warn('Failed to clear cache:', error);
        }
    }

    // ========================================
    // Network Status Monitoring
    // ========================================

    /**
     * Check if online
     */
    static isOnline() {
        return navigator.onLine;
    }

    /**
     * Setup online/offline event listeners
     */
    static setupNetworkMonitoring(callbacks = {}) {
        const { onOnline, onOffline } = callbacks;

        window.addEventListener('online', () => {
            console.log('Network: Online');
            if (onOnline) onOnline();
            
            // Automatically sync when coming back online
            this.syncLocalChanges().catch(error => {
                console.error('Auto-sync failed:', error);
            });
        });

        window.addEventListener('offline', () => {
            console.log('Network: Offline');
            if (onOffline) onOffline();
        });

        // Initial status
        console.log(`Network: ${this.isOnline() ? 'Online' : 'Offline'}`);
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
    }

    toString() {
        return `APIError ${this.status}: ${this.message}`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TaskAPI, APIError };
}