/**
 * WebSocket client for real-time updates in Kanban board
 */

class TaskMasterWebSocketClient {
    constructor(options = {}) {
        this.url = options.url || `ws://${window.location.hostname}:${window.location.port}`;
        this.reconnectInterval = options.reconnectInterval || 5000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
        this.heartbeatInterval = options.heartbeatInterval || 30000;
        
        this.ws = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.messageQueue = [];
        this.isConnected = false;
        this.isReconnecting = false;
        
        this.eventHandlers = {
            'CONNECTION_SUCCESS': [],
            'STATE_SYNC': [],
            'TASKS_UPDATED': [],
            'TASK_CREATED': [],
            'TASK_UPDATED': [],
            'TASK_DELETED': [],
            'STATUS_CHANGED': [],
            'CLIENT_COUNT_UPDATED': [],
            'ERROR': [],
            'connection': [],
            'disconnect': [],
            'reconnecting': []
        };
        
        // Bind methods
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.send = this.send.bind(this);
    }
    
    /**
     * Connect to WebSocket server
     */
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }
        
        try {
            console.log('Connecting to WebSocket:', this.url);
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            this.ws.onerror = this.handleError.bind(this);
            
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.scheduleReconnect();
        }
    }
    
    /**
     * Handle WebSocket open event
     */
    handleOpen(event) {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        
        // Clear reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Subscribe to updates
        this.send({ type: 'SUBSCRIBE' });
        
        // Process queued messages
        this.flushMessageQueue();
        
        // Trigger connection event
        this.trigger('connection', { timestamp: Date.now() });
        
        // Update UI status
        this.updateConnectionStatus('connected');
    }
    
    /**
     * Handle incoming WebSocket message
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('Received message:', message.type);
            
            // Handle specific message types
            if (this.eventHandlers[message.type]) {
                this.trigger(message.type, message);
            }
            
            // Handle special messages
            switch (message.type) {
                case 'PONG':
                    // Reset heartbeat timer
                    this.resetHeartbeat();
                    break;
                    
                case 'STATE_SYNC':
                    // Full state synchronization
                    this.handleStateSync(message.data);
                    break;
                    
                case 'TASKS_UPDATED':
                    // Handle task updates
                    this.handleTasksUpdated(message.changes);
                    break;
                    
                case 'ERROR':
                    console.error('Server error:', message.error);
                    break;
            }
            
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    
    /**
     * Handle WebSocket close event
     */
    handleClose(event) {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.ws = null;
        
        // Stop heartbeat
        this.stopHeartbeat();
        
        // Trigger disconnect event
        this.trigger('disconnect', {
            code: event.code,
            reason: event.reason,
            timestamp: Date.now()
        });
        
        // Update UI status
        this.updateConnectionStatus('disconnected');
        
        // Schedule reconnection if not a normal closure
        if (event.code !== 1000 && event.code !== 1001) {
            this.scheduleReconnect();
        }
    }
    
    /**
     * Handle WebSocket error event
     */
    handleError(event) {
        console.error('WebSocket error:', event);
        this.trigger('ERROR', { error: 'Connection error' });
    }
    
    /**
     * Send message to server
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('Error sending message:', error);
                this.queueMessage(message);
                return false;
            }
        } else {
            // Queue message for later
            this.queueMessage(message);
            return false;
        }
    }
    
    /**
     * Queue message for sending when connected
     */
    queueMessage(message) {
        this.messageQueue.push({
            message,
            timestamp: Date.now()
        });
        
        // Limit queue size
        if (this.messageQueue.length > 100) {
            this.messageQueue.shift();
        }
    }
    
    /**
     * Send all queued messages
     */
    flushMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const item = this.messageQueue.shift();
            this.send(item.message);
        }
    }
    
    /**
     * Start heartbeat timer
     */
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'PING' });
            }
        }, this.heartbeatInterval);
    }
    
    /**
     * Stop heartbeat timer
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    
    /**
     * Reset heartbeat timer
     */
    resetHeartbeat() {
        this.startHeartbeat();
    }
    
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.isReconnecting) return;
        
        this.isReconnecting = true;
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts > this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.updateConnectionStatus('failed');
            return;
        }
        
        const delay = Math.min(
            this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
            30000
        );
        
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        this.updateConnectionStatus('reconnecting');
        
        this.trigger('reconnecting', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            delay
        });
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnect();
        }, delay);
    }
    
    /**
     * Reconnect to server
     */
    reconnect() {
        this.disconnect();
        this.connect();
    }
    
    /**
     * Disconnect from server
     */
    disconnect() {
        this.isConnected = false;
        this.isReconnecting = false;
        
        // Clear timers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        this.stopHeartbeat();
        
        // Close WebSocket
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        
        // Clear message queue
        this.messageQueue = [];
    }
    
    /**
     * Handle state synchronization
     */
    handleStateSync(data) {
        console.log('State sync received');
        
        // Update local state
        if (window.kanbanBoard) {
            window.kanbanBoard.tasks = data.master?.tasks || data.tasks || [];
            window.kanbanBoard.renderTasks();
            window.kanbanBoard.updateTaskCounts();
        }
    }
    
    /**
     * Handle task updates
     */
    handleTasksUpdated(changes) {
        console.log('Tasks updated:', changes);
        
        if (!changes || changes.length === 0) return;
        
        changes.forEach(change => {
            switch (change.type) {
                case 'BULK_UPDATE':
                    // Reload all tasks
                    if (window.kanbanBoard) {
                        window.kanbanBoard.loadTasks();
                    }
                    break;
                    
                case 'TASK_CREATED':
                    // Add new task
                    if (window.kanbanBoard && change.task) {
                        window.kanbanBoard.tasks.push(change.task);
                        window.kanbanBoard.renderTasks();
                    }
                    break;
                    
                case 'TASK_UPDATED':
                    // Update existing task
                    if (window.kanbanBoard && change.task) {
                        const index = window.kanbanBoard.tasks.findIndex(
                            t => t.id === change.task.id
                        );
                        if (index >= 0) {
                            window.kanbanBoard.tasks[index] = change.task;
                            window.kanbanBoard.renderTasks();
                        }
                    }
                    break;
                    
                case 'TASK_DELETED':
                    // Remove task
                    if (window.kanbanBoard && change.taskId) {
                        window.kanbanBoard.tasks = window.kanbanBoard.tasks.filter(
                            t => t.id !== change.taskId
                        );
                        window.kanbanBoard.renderTasks();
                    }
                    break;
            }
        });
        
        // Update task counts
        if (window.kanbanBoard) {
            window.kanbanBoard.updateTaskCounts();
        }
        
        // Show notification
        this.showNotification('Tasks updated from server');
    }
    
    /**
     * Update connection status in UI
     */
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('ws-status');
        if (!statusElement) {
            // Create status element if doesn't exist
            const header = document.querySelector('.kanban-header');
            if (header) {
                const statusDiv = document.createElement('div');
                statusDiv.id = 'ws-status';
                statusDiv.className = 'ws-status';
                header.appendChild(statusDiv);
            }
            return;
        }
        
        statusElement.className = `ws-status ws-status-${status}`;
        
        const statusMessages = {
            'connected': '🟢 Connected',
            'disconnected': '🔴 Disconnected',
            'reconnecting': '🟡 Reconnecting...',
            'failed': '⚠️ Connection Failed'
        };
        
        statusElement.textContent = statusMessages[status] || status;
        statusElement.setAttribute('title', `WebSocket ${status}`);
    }
    
    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.kanbanBoard && window.kanbanBoard.showSuccess) {
            if (type === 'error') {
                window.kanbanBoard.showError(message);
            } else {
                window.kanbanBoard.showSuccess(message);
            }
        } else {
            console.log('Notification:', message);
        }
    }
    
    /**
     * Register event handler
     */
    on(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].push(handler);
        }
    }
    
    /**
     * Unregister event handler
     */
    off(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index >= 0) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
    }
    
    /**
     * Trigger event handlers
     */
    trigger(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Request full state sync from server
     */
    requestSync() {
        this.send({ type: 'REQUEST_SYNC' });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskMasterWebSocketClient;
}