/**
 * Smart Priority Queue for AST Performance System
 * 
 * Multi-level task scheduling based purely on file relevance scores
 * with intelligent prioritization and preemptive cancellation.
 */

import { EventEmitter } from 'events';

export class SmartPriorityQueue extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            criticalDelay: this._parseDuration(config.criticalDelay || '100ms'),
            highDelay: this._parseDuration(config.highDelay || '500ms'),
            mediumDelay: this._parseDuration(config.mediumDelay || '2s'),
            lowDelay: this._parseDuration(config.lowDelay || '5s'),
            fairnessRatio: config.fairnessRatio || 0.1,
            debounceWindow: this._parseDuration(config.debounceWindow || '300ms')
        };
        
        // 4-Tier Priority Queues based on file relevance
        this.queues = {
            critical: [], // 90-100% relevance - Currently open/edited files
            high: [],     // 70-89% relevance - Recent changes in current worktree
            medium: [],   // 40-69% relevance - Dependencies and related files
            low: []       // 0-39% relevance - Background cache warming
        };
        
        // Task management
        this.activeTasks = new Map();
        this.taskCounter = 0;
        
        // Fairness management
        this.fairnessCounter = 0;
        
        // Performance metrics
        this.metrics = {
            totalEnqueued: 0,
            totalDequeued: 0,
            totalCancelled: 0,
            preemptiveCancellations: 0
        };
        
        // Relevance scorer integration
        this.relevanceScorer = null;
    }
    
    /**
     * Initialize the priority queue system
     */
    async initialize(relevanceScorer = null) {
        this.relevanceScorer = relevanceScorer;
        
        this.emit('queue:initialized', {
            config: this.config
        });
    }
    
    /**
     * Enqueue a task with context-aware priority based on file relevance
     */
    enqueue(task, context = {}) {
        const taskId = ++this.taskCounter;
        
        // Calculate priority based on file relevance score
        const relevanceScore = this._calculateRelevanceScore(task, context);
        const priority = this._mapRelevanceToPriority(relevanceScore);
        
        const taskWrapper = {
            id: taskId,
            task,
            context,
            priority,
            relevanceScore,
            enqueuedAt: Date.now()
        };
        
        // Cancel obsolete tasks for the same file
        this._cancelObsoleteTasks(task.filePath);
        
        // Add to appropriate priority queue
        this.queues[priority].push(taskWrapper);
        this.activeTasks.set(taskId, taskWrapper);
        this.metrics.totalEnqueued++;
        
        this.emit('task:enqueued', {
            taskId,
            priority,
            relevanceScore,
            queueSize: this.queues[priority].length
        });
        
        return taskId;
    }
    
    /**
     * Dequeue the next highest priority task
     */
    dequeue() {
        // Select queue based on fairness algorithm
        const queueName = this._selectQueueForProcessing();
        if (!queueName) return null;
        
        const queue = this.queues[queueName];
        if (queue.length === 0) return null;
        
        // Get the oldest task from the selected queue (FIFO within priority)
        const taskWrapper = queue.shift();
        this.activeTasks.delete(taskWrapper.id);
        this.metrics.totalDequeued++;
        
        // Update fairness counter
        this.fairnessCounter++;
        
        this.emit('task:dequeued', {
            taskId: taskWrapper.id,
            priority: queueName,
            relevanceScore: taskWrapper.relevanceScore
        });
        
        return taskWrapper;
    }
    
    /**
     * Cancel obsolete tasks for a specific file
     */
    cancelObsoleteTasks(filePath) {
        return this._cancelObsoleteTasks(filePath);
    }
    
    /**
     * Get comprehensive queue statistics
     */
    getQueueStatistics() {
        const stats = {};
        
        for (const [priority, queue] of Object.entries(this.queues)) {
            stats[priority] = {
                queueLength: queue.length,
                oldestTaskAge: queue.length > 0 ? Date.now() - queue[0].enqueuedAt : 0
            };
        }
        
        return {
            queues: stats,
            metrics: this.metrics,
            totalActiveTasks: this.activeTasks.size
        };
    }
    
    /**
     * Clear all queues
     */
    clear() {
        for (const queue of Object.values(this.queues)) {
            queue.length = 0;
        }
        this.activeTasks.clear();
        this.emit('queue:cleared');
    }
    
    // Private methods
    
    /**
     * Calculate relevance score based on context
     */
    _calculateRelevanceScore(task, context) {
        if (this.relevanceScorer) {
            return this.relevanceScorer.calculateRelevance(task.filePath, context);
        }
        
        // Fallback scoring based on context hints
        let score = 0;
        
        if (context.isCurrentlyOpen || context.isActiveFile) {
            score += 40;
        }
        
        if (context.lastModified && (Date.now() - context.lastModified) < 300000) {
            score += 30;
        }
        
        if (context.isInCurrentWorktree) {
            score += 20;
        }
        
        if (context.isRelatedToCurrentTask) {
            score += 10;
        }
        
        return Math.min(100, score);
    }
    
    /**
     * Map relevance score to priority queue
     */
    _mapRelevanceToPriority(relevanceScore) {
        if (relevanceScore >= 90) return 'critical';
        if (relevanceScore >= 70) return 'high';
        if (relevanceScore >= 40) return 'medium';
        return 'low';
    }
    
    /**
     * Cancel obsolete tasks for a specific file
     */
    _cancelObsoleteTasks(filePath) {
        const cancelledIds = [];
        
        for (const [priority, queue] of Object.entries(this.queues)) {
            for (let i = queue.length - 1; i >= 0; i--) {
                const task = queue[i];
                if (task.task.filePath === filePath) {
                    queue.splice(i, 1);
                    this.activeTasks.delete(task.id);
                    cancelledIds.push(task.id);
                    this.metrics.totalCancelled++;
                    this.metrics.preemptiveCancellations++;
                }
            }
        }
        
        if (cancelledIds.length > 0) {
            this.emit('tasks:cancelled', {
                filePath,
                cancelledIds,
                count: cancelledIds.length
            });
        }
        
        return cancelledIds;
    }
    
    /**
     * Select queue for processing based on fairness algorithm
     */
    _selectQueueForProcessing() {
        // Always process critical first if available
        if (this.queues.critical.length > 0) {
            return 'critical';
        }
        
        // Fairness algorithm: occasionally process lower priority queues
        const shouldProcessLowPriority = this.fairnessCounter % Math.floor(1 / this.config.fairnessRatio) === 0;
        
        if (shouldProcessLowPriority) {
            if (this.queues.low.length > 0) return 'low';
            if (this.queues.medium.length > 0) return 'medium';
        }
        
        // Default priority order
        if (this.queues.high.length > 0) return 'high';
        if (this.queues.medium.length > 0) return 'medium';
        if (this.queues.low.length > 0) return 'low';
        
        return null;
    }
    
    /**
     * Parse duration string to milliseconds
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
}

export default SmartPriorityQueue; 