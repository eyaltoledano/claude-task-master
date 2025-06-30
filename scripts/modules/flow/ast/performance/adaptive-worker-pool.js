/**
 * Adaptive Worker Pool for AST Performance System
 * 
 * Implements hybrid approach:
 * - Worker Threads for JavaScript/TypeScript parsing (better performance)
 * - Child Processes for Python/Go parsing (language runtime isolation)
 * 
 * Features dynamic scaling, task cancellation, and load balancing.
 */

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { spawn } from 'child_process';
import { cpus } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AdaptiveWorkerPool extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            maxConcurrentOperations: config.maxConcurrentOperations || Math.max(1, cpus().length - 1),
            dynamicScaling: config.dynamicScaling !== false,
            workerTimeout: this._parseDuration(config.workerTimeout || '30s'),
            taskCancellation: config.taskCancellation !== false,
            healthCheckInterval: this._parseDuration(config.healthCheckInterval || '5s')
        };
        
        // Worker pools by language
        this.pools = {
            javascript: { type: 'thread', workers: [], active: 0, queue: [] },
            typescript: { type: 'thread', workers: [], active: 0, queue: [] },
            python: { type: 'process', workers: [], active: 0, queue: [] },
            go: { type: 'process', workers: [], active: 0, queue: [] }
        };
        
        // Task management
        this.activeTasks = new Map();
        this.taskCounter = 0;
        this.isShuttingDown = false;
        
        // Performance metrics
        this.metrics = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            cancelledTasks: 0,
            averageTaskTime: 0,
            poolScalings: 0,
            workerRestarts: 0
        };
        
        // Health check interval
        this.healthCheckInterval = null;
        
        // Resource monitor integration
        this.resourceMonitor = null;
    }
    
    /**
     * Initialize the worker pool system
     */
    async initialize(resourceMonitor = null) {
        this.resourceMonitor = resourceMonitor;
        
        // Initialize pools for each language
        for (const language of Object.keys(this.pools)) {
            await this._initializePool(language);
        }
        
        // Start health checks
        this._startHealthChecks();
        
        this.emit('pool:initialized', {
            pools: Object.keys(this.pools),
            config: this.config
        });
    }
    
    /**
     * Submit a parsing task to the appropriate worker pool
     */
    async submitTask(task, priority = 0) {
        if (this.isShuttingDown) {
            throw new Error('Worker pool is shutting down');
        }
        
        const taskId = ++this.taskCounter;
        const language = this._detectLanguage(task.filePath);
        
        if (!this.pools[language]) {
            throw new Error(`Unsupported language: ${language}`);
        }
        
        const taskWrapper = {
            id: taskId,
            language,
            priority,
            task,
            submittedAt: Date.now(),
            timeout: null
        };
        
        this.activeTasks.set(taskId, taskWrapper);
        this.metrics.totalTasks++;
        
        // Add task to appropriate pool queue
        const pool = this.pools[language];
        pool.queue.push(taskWrapper);
        pool.queue.sort((a, b) => b.priority - a.priority); // Sort by priority
        
        // Try to process the task immediately
        this._processQueue(language);
        
        return taskId;
    }
    
    /**
     * Cancel a specific task
     */
    cancelTask(taskId) {
        const task = this.activeTasks.get(taskId);
        if (!task) {
            return false;
        }
        
        // Remove from queue if not yet started
        const pool = this.pools[task.language];
        const queueIndex = pool.queue.findIndex(t => t.id === taskId);
        if (queueIndex !== -1) {
            pool.queue.splice(queueIndex, 1);
            this._cleanupTask(taskId, 'cancelled');
            return true;
        }
        
        // Cancel running task
        if (task.worker) {
            this._terminateWorker(task.worker, task.language);
            this._cleanupTask(taskId, 'cancelled');
            return true;
        }
        
        return false;
    }
    
    /**
     * Cancel all tasks for a specific file (when file changes again)
     */
    cancelTasksForFile(filePath) {
        const cancelledIds = [];
        
        for (const [taskId, task] of this.activeTasks.entries()) {
            if (task.task.filePath === filePath) {
                if (this.cancelTask(taskId)) {
                    cancelledIds.push(taskId);
                }
            }
        }
        
        return cancelledIds;
    }
    
    /**
     * Scale pool size based on resource availability
     */
    async scalePool(language, cpuUsage, memoryUsage) {
        if (!this.config.dynamicScaling) {
            return;
        }
        
        const pool = this.pools[language];
        if (!pool) return;
        
        let targetSize = this.config.maxConcurrentOperations;
        
        // Adjust based on resource usage
        if (cpuUsage > 80) {
            targetSize = Math.max(1, Math.floor(targetSize * 0.5));
        } else if (cpuUsage > 60) {
            targetSize = Math.max(1, Math.floor(targetSize * 0.75));
        }
        
        if (memoryUsage > 150 * 1024 * 1024) { // 150MB
            targetSize = Math.max(1, Math.floor(targetSize * 0.5));
        }
        
        const currentSize = pool.workers.length;
        
        if (targetSize > currentSize) {
            // Scale up
            for (let i = currentSize; i < targetSize; i++) {
                await this._createWorker(language);
            }
            this.metrics.poolScalings++;
        } else if (targetSize < currentSize) {
            // Scale down
            const workersToRemove = currentSize - targetSize;
            for (let i = 0; i < workersToRemove; i++) {
                this._removeIdleWorker(language);
            }
            this.metrics.poolScalings++;
        }
    }
    
    /**
     * Get pool statistics
     */
    getPoolStatistics() {
        const stats = {};
        
        for (const [language, pool] of Object.entries(this.pools)) {
            stats[language] = {
                type: pool.type,
                totalWorkers: pool.workers.length,
                activeWorkers: pool.active,
                queuedTasks: pool.queue.length,
                averageQueueWait: this._calculateAverageQueueWait(pool)
            };
        }
        
        return {
            pools: stats,
            metrics: this.metrics,
            activeTasks: this.activeTasks.size
        };
    }
    
    /**
     * Gracefully shutdown all workers
     */
    async shutdown() {
        this.isShuttingDown = true;
        
        // Stop health checks
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        // Cancel all pending tasks
        for (const taskId of this.activeTasks.keys()) {
            this.cancelTask(taskId);
        }
        
        // Terminate all workers
        for (const [language, pool] of Object.entries(this.pools)) {
            await this._terminateAllWorkers(language);
        }
        
        this.emit('pool:shutdown', {
            finalMetrics: this.metrics
        });
    }
    
    // Private methods
    
    /**
     * Initialize a worker pool for a specific language
     */
    async _initializePool(language) {
        const pool = this.pools[language];
        
        // Create initial workers
        const initialWorkers = Math.min(2, this.config.maxConcurrentOperations);
        for (let i = 0; i < initialWorkers; i++) {
            await this._createWorker(language);
        }
    }
    
    /**
     * Create a new worker for the specified language
     */
    async _createWorker(language) {
        const pool = this.pools[language];
        
        if (pool.workers.length >= this.config.maxConcurrentOperations) {
            return null;
        }
        
        let worker;
        
        if (pool.type === 'thread') {
            // Worker Thread for JavaScript/TypeScript
            const workerPath = path.join(__dirname, `../workers/${language}-worker.js`);
            worker = new Worker(workerPath);
            
            worker.on('message', (result) => {
                this._handleWorkerResult(worker, result);
            });
            
            worker.on('error', (error) => {
                this._handleWorkerError(worker, language, error);
            });
            
            worker.on('exit', (code) => {
                this._handleWorkerExit(worker, language, code);
            });
            
        } else {
            // Child Process for Python/Go
            const workerScript = language === 'python' 
                ? path.join(__dirname, `../workers/${language}_worker.py`)
                : path.join(__dirname, `../workers/${language}_worker.go`);
                
            worker = spawn(language === 'python' ? 'python3' : 'go', 
                language === 'python' ? [workerScript] : ['run', workerScript]);
            
            worker.stdout.on('data', (data) => {
                try {
                    const result = JSON.parse(data.toString());
                    this._handleWorkerResult(worker, result);
                } catch (error) {
                    this._handleWorkerError(worker, language, error);
                }
            });
            
            worker.stderr.on('data', (data) => {
                this._handleWorkerError(worker, language, new Error(data.toString()));
            });
            
            worker.on('exit', (code) => {
                this._handleWorkerExit(worker, language, code);
            });
        }
        
        worker.language = language;
        worker.isIdle = true;
        worker.currentTask = null;
        worker.createdAt = Date.now();
        
        pool.workers.push(worker);
        
        return worker;
    }
    
    /**
     * Process the queue for a specific language
     */
    _processQueue(language) {
        const pool = this.pools[language];
        
        if (pool.queue.length === 0) {
            return;
        }
        
        // Find an idle worker
        const idleWorker = pool.workers.find(w => w.isIdle);
        if (!idleWorker) {
            return;
        }
        
        // Get highest priority task
        const taskWrapper = pool.queue.shift();
        if (!taskWrapper) {
            return;
        }
        
        // Assign task to worker
        idleWorker.isIdle = false;
        idleWorker.currentTask = taskWrapper;
        taskWrapper.worker = idleWorker;
        taskWrapper.startedAt = Date.now();
        
        pool.active++;
        
        // Set task timeout
        if (this.config.workerTimeout > 0) {
            taskWrapper.timeout = setTimeout(() => {
                this._handleTaskTimeout(taskWrapper);
            }, this.config.workerTimeout);
        }
        
        // Send task to worker
        this._sendTaskToWorker(idleWorker, taskWrapper);
    }
    
    /**
     * Send task to worker based on type
     */
    _sendTaskToWorker(worker, taskWrapper) {
        const message = {
            taskId: taskWrapper.id,
            filePath: taskWrapper.task.filePath,
            content: taskWrapper.task.content,
            options: taskWrapper.task.options || {}
        };
        
        if (worker.language === 'javascript' || worker.language === 'typescript') {
            // Worker Thread
            worker.postMessage(message);
        } else {
            // Child Process
            worker.stdin.write(JSON.stringify(message) + '\n');
        }
    }
    
    /**
     * Handle worker result
     */
    _handleWorkerResult(worker, result) {
        const taskId = result.taskId;
        const taskWrapper = this.activeTasks.get(taskId);
        
        if (!taskWrapper) {
            return;
        }
        
        this._cleanupTask(taskId, 'completed');
        
        // Mark worker as idle
        worker.isIdle = true;
        worker.currentTask = null;
        this.pools[worker.language].active--;
        
        // Update metrics
        this.metrics.completedTasks++;
        const taskTime = Date.now() - taskWrapper.startedAt;
        this.metrics.averageTaskTime = 
            (this.metrics.averageTaskTime * (this.metrics.completedTasks - 1) + taskTime) / 
            this.metrics.completedTasks;
        
        // Emit task completion
        this.emit('task:completed', {
            taskId,
            result: result.data,
            duration: taskTime
        });
        
        // Process next task in queue
        this._processQueue(worker.language);
    }
    
    /**
     * Handle worker error
     */
    _handleWorkerError(worker, language, error) {
        if (worker.currentTask) {
            this._cleanupTask(worker.currentTask.id, 'failed');
            this.metrics.failedTasks++;
        }
        
        // Remove and recreate worker
        this._removeWorker(worker, language);
        this._createWorker(language);
        this.metrics.workerRestarts++;
        
        this.emit('worker:error', { language, error: error.message });
    }
    
    /**
     * Handle worker exit
     */
    _handleWorkerExit(worker, language, code) {
        if (code !== 0 && worker.currentTask) {
            this._cleanupTask(worker.currentTask.id, 'failed');
            this.metrics.failedTasks++;
        }
        
        this._removeWorker(worker, language);
        
        // Recreate worker if not shutting down
        if (!this.isShuttingDown) {
            this._createWorker(language);
            this.metrics.workerRestarts++;
        }
    }
    
    /**
     * Clean up completed/failed/cancelled task
     */
    _cleanupTask(taskId, status) {
        const task = this.activeTasks.get(taskId);
        if (!task) return;
        
        // Clear timeout
        if (task.timeout) {
            clearTimeout(task.timeout);
        }
        
        // Update metrics
        if (status === 'cancelled') {
            this.metrics.cancelledTasks++;
        }
        
        // Remove from active tasks
        this.activeTasks.delete(taskId);
        
        this.emit('task:' + status, { taskId, task });
    }
    
    /**
     * Handle task timeout
     */
    _handleTaskTimeout(taskWrapper) {
        this._terminateWorker(taskWrapper.worker, taskWrapper.language);
        this._cleanupTask(taskWrapper.id, 'failed');
        this.metrics.failedTasks++;
    }
    
    /**
     * Detect language from file path
     */
    _detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        switch (ext) {
            case '.js': return 'javascript';
            case '.jsx': return 'javascript';
            case '.ts': return 'typescript';
            case '.tsx': return 'typescript';
            case '.py': return 'python';
            case '.go': return 'go';
            default: return 'javascript'; // Default fallback
        }
    }
    
    /**
     * Start health checks for workers
     */
    _startHealthChecks() {
        this.healthCheckInterval = setInterval(() => {
            for (const [language, pool] of Object.entries(this.pools)) {
                // Check for stuck workers
                const now = Date.now();
                for (const worker of pool.workers) {
                    if (!worker.isIdle && worker.currentTask) {
                        const taskAge = now - worker.currentTask.startedAt;
                        if (taskAge > this.config.workerTimeout * 2) {
                            this._terminateWorker(worker, language);
                        }
                    }
                }
            }
        }, this.config.healthCheckInterval);
    }
    
    /**
     * Utility methods
     */
    _parseDuration(duration) {
        if (typeof duration === 'number') return duration;
        const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/);
        if (!match) throw new Error(`Invalid duration: ${duration}`);
        const value = parseFloat(match[1]);
        const unit = match[2] || 'ms';
        switch (unit) {
            case 'ms': return value;
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            default: throw new Error(`Invalid duration unit: ${unit}`);
        }
    }
    
    _removeWorker(worker, language) {
        const pool = this.pools[language];
        const index = pool.workers.indexOf(worker);
        if (index !== -1) {
            pool.workers.splice(index, 1);
        }
    }
    
    _terminateWorker(worker, language) {
        if (worker.language === 'javascript' || worker.language === 'typescript') {
            worker.terminate();
        } else {
            worker.kill();
        }
        this._removeWorker(worker, language);
    }
    
    _removeIdleWorker(language) {
        const pool = this.pools[language];
        const idleWorker = pool.workers.find(w => w.isIdle);
        if (idleWorker) {
            this._terminateWorker(idleWorker, language);
        }
    }
    
    async _terminateAllWorkers(language) {
        const pool = this.pools[language];
        const workers = [...pool.workers];
        for (const worker of workers) {
            this._terminateWorker(worker, language);
        }
    }
    
    _calculateAverageQueueWait(pool) {
        if (pool.queue.length === 0) return 0;
        const now = Date.now();
        const totalWait = pool.queue.reduce((sum, task) => sum + (now - task.submittedAt), 0);
        return totalWait / pool.queue.length;
    }
}

export default AdaptiveWorkerPool; 