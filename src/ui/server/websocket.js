/**
 * WebSocket server implementation for real-time updates
 */

import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TaskMasterWebSocketServer {
    constructor(server, options = {}) {
        this.httpServer = server;
        this.clients = new Set();
        this.taskFilePath = options.taskFilePath || path.join(process.cwd(), '.taskmaster/tasks/tasks.json');
        this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
        this.maxPayload = options.maxPayload || 1024 * 1024; // 1MB
        this.allowedOrigins = options.allowedOrigins || ['http://localhost:3000', 'http://localhost:3001'];
        
        this.wss = null;
        this.fileWatcher = null;
        this.heartbeatTimer = null;
        this.lastTasksState = null;
        
        this.messageHandlers = {
            'PING': this.handlePing.bind(this),
            'SUBSCRIBE': this.handleSubscribe.bind(this),
            'UNSUBSCRIBE': this.handleUnsubscribe.bind(this),
            'REQUEST_SYNC': this.handleRequestSync.bind(this)
        };
    }
    
    /**
     * Initialize the WebSocket server
     */
    init() {
        // Create WebSocket server
        this.wss = new WebSocketServer({
            noServer: true,
            perMessageDeflate: false,
            maxPayload: this.maxPayload,
            clientTracking: true
        });
        
        // Handle HTTP server upgrade
        this.httpServer.on('upgrade', (request, socket, head) => {
            // Validate origin
            const origin = request.headers.origin;
            if (origin && !this.validateOrigin(origin)) {
                socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                socket.destroy();
                return;
            }
            
            this.wss.handleUpgrade(request, socket, head, (ws) => {
                this.wss.emit('connection', ws, request);
            });
        });
        
        // Handle new connections
        this.wss.on('connection', this.handleConnection.bind(this));
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Start file watcher
        this.startFileWatcher();
        
        console.log('WebSocket server initialized');
    }
    
    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws, request) {
        console.log('New WebSocket connection from:', request.socket.remoteAddress);
        
        // Add to clients
        this.clients.add(ws);
        ws.isAlive = true;
        
        // Send initial connection success message
        this.sendMessage(ws, {
            type: 'CONNECTION_SUCCESS',
            timestamp: Date.now(),
            clientCount: this.clients.size
        });
        
        // Setup event handlers
        ws.on('message', (data) => this.handleMessage(ws, data));
        ws.on('pong', () => this.handlePong(ws));
        ws.on('close', () => this.handleDisconnect(ws));
        ws.on('error', (error) => this.handleError(ws, error));
        
        // Send current state
        this.sendCurrentState(ws);
    }
    
    /**
     * Handle incoming message from client
     */
    handleMessage(ws, data) {
        try {
            const message = JSON.parse(data.toString());
            console.log('Received message:', message.type);
            
            const handler = this.messageHandlers[message.type];
            if (handler) {
                handler(ws, message);
            } else {
                this.sendMessage(ws, {
                    type: 'ERROR',
                    error: `Unknown message type: ${message.type}`
                });
            }
        } catch (error) {
            console.error('Error parsing message:', error);
            this.sendMessage(ws, {
                type: 'ERROR',
                error: 'Invalid message format'
            });
        }
    }
    
    /**
     * Handle ping message
     */
    handlePing(ws, message) {
        this.sendMessage(ws, {
            type: 'PONG',
            timestamp: Date.now()
        });
    }
    
    /**
     * Handle subscribe message
     */
    handleSubscribe(ws, message) {
        ws.subscribed = true;
        this.sendMessage(ws, {
            type: 'SUBSCRIBED',
            timestamp: Date.now()
        });
    }
    
    /**
     * Handle unsubscribe message
     */
    handleUnsubscribe(ws, message) {
        ws.subscribed = false;
        this.sendMessage(ws, {
            type: 'UNSUBSCRIBED',
            timestamp: Date.now()
        });
    }
    
    /**
     * Handle sync request
     */
    handleRequestSync(ws, message) {
        this.sendCurrentState(ws);
    }
    
    /**
     * Handle pong response
     */
    handlePong(ws) {
        ws.isAlive = true;
    }
    
    /**
     * Handle client disconnect
     */
    handleDisconnect(ws) {
        console.log('Client disconnected');
        this.clients.delete(ws);
        
        // Broadcast updated client count
        this.broadcast({
            type: 'CLIENT_COUNT_UPDATED',
            count: this.clients.size,
            timestamp: Date.now()
        });
    }
    
    /**
     * Handle WebSocket error
     */
    handleError(ws, error) {
        console.error('WebSocket error:', error);
    }
    
    /**
     * Start heartbeat interval
     */
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    console.log('Terminating dead connection');
                    ws.terminate();
                    this.clients.delete(ws);
                    return;
                }
                
                ws.isAlive = false;
                ws.ping();
            });
        }, this.heartbeatInterval);
    }
    
    /**
     * Start file watcher for tasks.json
     */
    startFileWatcher() {
        // Initial state
        this.loadTasksState();
        
        // Watch for changes
        let debounceTimer = null;
        
        fs.watch(this.taskFilePath, (eventType, filename) => {
            // Debounce rapid changes
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log(`File ${eventType}: ${filename}`);
                this.handleFileChange();
            }, 500);
        });
        
        console.log('Watching tasks file:', this.taskFilePath);
    }
    
    /**
     * Load current tasks state
     */
    loadTasksState() {
        try {
            const data = fs.readFileSync(this.taskFilePath, 'utf8');
            this.lastTasksState = JSON.parse(data);
            return this.lastTasksState;
        } catch (error) {
            console.error('Error loading tasks:', error);
            return null;
        }
    }
    
    /**
     * Handle file change
     */
    handleFileChange() {
        const newState = this.loadTasksState();
        if (!newState) return;
        
        // Detect changes
        const changes = this.detectChanges(this.lastTasksState, newState);
        
        if (changes.length > 0) {
            // Broadcast changes
            this.broadcast({
                type: 'TASKS_UPDATED',
                changes,
                timestamp: Date.now()
            });
            
            this.lastTasksState = newState;
        }
    }
    
    /**
     * Detect changes between old and new state
     */
    detectChanges(oldState, newState) {
        const changes = [];
        
        // Simple comparison - can be enhanced
        if (JSON.stringify(oldState) !== JSON.stringify(newState)) {
            changes.push({
                type: 'BULK_UPDATE',
                data: newState
            });
        }
        
        return changes;
    }
    
    /**
     * Send current state to a client
     */
    sendCurrentState(ws) {
        const state = this.loadTasksState();
        if (state) {
            this.sendMessage(ws, {
                type: 'STATE_SYNC',
                data: state,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Send message to a specific client
     */
    sendMessage(ws, message) {
        if (ws.readyState === ws.OPEN) {
            try {
                ws.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('Error sending message:', error);
                return false;
            }
        }
        return false;
    }
    
    /**
     * Broadcast message to all connected clients
     */
    broadcast(message, excludeWs = null) {
        const data = JSON.stringify(message);
        let sent = 0;
        
        this.clients.forEach((client) => {
            if (client !== excludeWs && client.readyState === client.OPEN) {
                try {
                    client.send(data);
                    sent++;
                } catch (error) {
                    console.error('Broadcast error:', error);
                }
            }
        });
        
        console.log(`Broadcast sent to ${sent} clients`);
        return sent;
    }
    
    /**
     * Validate origin for CORS
     */
    validateOrigin(origin) {
        return this.allowedOrigins.includes(origin) || 
               origin.startsWith('http://localhost:');
    }
    
    /**
     * Shutdown WebSocket server
     */
    shutdown() {
        console.log('Shutting down WebSocket server...');
        
        // Clear intervals
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        
        // Close all connections
        this.clients.forEach((client) => {
            client.close(1000, 'Server shutting down');
        });
        
        // Close server
        if (this.wss) {
            this.wss.close();
        }
    }
}

export default TaskMasterWebSocketServer;