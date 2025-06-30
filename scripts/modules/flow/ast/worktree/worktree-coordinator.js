/**
 * Worktree Coordinator for Phase 3.4
 * 
 * Research-backed cross-worktree coordination and conflict resolution.
 * Handles resource sharing, serialized git operations, and context isolation.
 * 
 * Key Features:
 * - Serialized git command execution
 * - Cross-worktree resource sharing
 * - Conflict detection and resolution
 * - Context isolation per worktree
 */

import { EventEmitter } from 'events';
import path from 'path';

/**
 * Worktree Coordinator
 * 
 * Coordinates file watchers and resources across multiple git worktrees.
 * Implements research-backed patterns for conflict-free operations.
 */
class WorktreeCoordinator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            maxRetries: options.maxRetries || 3,
            retryDelayMs: options.retryDelayMs || 100,
            conflictTimeoutMs: options.conflictTimeoutMs || 5000,
            ...options
        };
        
        // Cross-worktree state management
        this.worktreeContexts = new Map();      // worktreePath -> isolated context
        this.sharedResources = new Map();       // resource -> usage tracking
        this.activeOperations = new Map();      // operationId -> operation details
        
        // Git operation coordination
        this.gitOperationQueue = [];            // Serialized git operations
        this.gitOperationRunning = false;       // Git operation lock
        
        // Conflict tracking
        this.conflictHistory = [];              // Historical conflict data
        this.activeConflicts = new Set();       // Currently active conflicts
        
        // Performance statistics
        this.stats = {
            operationsCompleted: 0,
            conflictsDetected: 0,
            conflictsResolved: 0,
            resourceSharingEvents: 0,
            retryAttempts: 0,
            startTime: Date.now()
        };
        
        console.log('WorktreeCoordinator initialized for cross-worktree coordination');
    }
    
    /**
     * Register a worktree for coordination
     */
    registerWorktree(worktreePath, metadata = {}) {
        if (this.worktreeContexts.has(worktreePath)) {
            console.warn(`Worktree already registered: ${worktreePath}`);
            return;
        }
        
        // Create isolated context for this worktree
        const context = {
            path: worktreePath,
            ...metadata,
            registeredAt: Date.now(),
            resources: new Set(),           // Resources used by this worktree
            operations: new Set(),          // Active operations in this worktree
            watcherId: null,                // Associated file watcher
            dependencyGraph: new Map(),     // Dependency relationships
            isolation: {
                buildCache: this.createIsolatedPath(worktreePath, 'build'),
                tempFiles: this.createIsolatedPath(worktreePath, 'temp'),
                lockFiles: this.createIsolatedPath(worktreePath, 'locks')
            }
        };
        
        this.worktreeContexts.set(worktreePath, context);
        
        console.log(`Registered worktree for coordination: ${worktreePath}`);
        
        this.emit('worktreeRegistered', {
            path: worktreePath,
            context
        });
        
        return context;
    }
    
    /**
     * Unregister a worktree from coordination
     */
    unregisterWorktree(worktreePath) {
        const context = this.worktreeContexts.get(worktreePath);
        if (!context) {
            return;
        }
        
        // Clean up any active operations for this worktree
        this.cancelWorktreeOperations(worktreePath);
        
        // Release shared resources
        this.releaseWorktreeResources(worktreePath);
        
        // Remove context
        this.worktreeContexts.delete(worktreePath);
        
        console.log(`Unregistered worktree from coordination: ${worktreePath}`);
        
        this.emit('worktreeUnregistered', {
            path: worktreePath,
            context
        });
    }
    
    /**
     * Execute git command with cross-worktree coordination
     */
    async executeGitCommand(command, worktreePath, options = {}) {
        const operationId = this.generateOperationId();
        
        return new Promise((resolve, reject) => {
            const operation = {
                id: operationId,
                command,
                worktreePath,
                options,
                resolve,
                reject,
                queuedAt: Date.now(),
                retryCount: 0
            };
            
            // Add to git operation queue
            this.gitOperationQueue.push(operation);
            
            // Track active operation
            this.activeOperations.set(operationId, operation);
            
            // Process queue
            this.processGitOperationQueue();
        });
    }
    
    /**
     * Process git operation queue with serialization
     */
    async processGitOperationQueue() {
        if (this.gitOperationRunning || this.gitOperationQueue.length === 0) {
            return;
        }
        
        this.gitOperationRunning = true;
        
        try {
            while (this.gitOperationQueue.length > 0) {
                const operation = this.gitOperationQueue.shift();
                
                try {
                    // Check for conflicts before execution
                    const conflicts = await this.detectConflicts(operation);
                    if (conflicts.length > 0) {
                        await this.resolveConflicts(conflicts, operation);
                    }
                    
                    // Execute the git command
                    const result = await this.executeGitOperation(operation);
                    
                    // Mark operation as completed
                    this.completeOperation(operation, result);
                    
                } catch (error) {
                    // Handle operation failure
                    await this.handleOperationFailure(operation, error);
                }
            }
        } finally {
            this.gitOperationRunning = false;
        }
    }
    
    /**
     * Execute individual git operation
     */
    async executeGitOperation(operation) {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        console.log(`Executing git command: ${operation.command} in ${operation.worktreePath}`);
        
        const result = await execAsync(`git ${operation.command}`, {
            cwd: operation.worktreePath,
            timeout: this.config.conflictTimeoutMs,
            ...operation.options
        });
        
        this.stats.operationsCompleted++;
        
        return result;
    }
    
    /**
     * Detect potential conflicts for operation
     */
    async detectConflicts(operation) {
        const conflicts = [];
        
        // Check for concurrent git operations on same repository
        for (const [activeId, activeOp] of this.activeOperations) {
            if (activeId !== operation.id && 
                this.isSharedRepository(operation.worktreePath, activeOp.worktreePath)) {
                
                conflicts.push({
                    type: 'concurrent_git_operation',
                    operation: operation,
                    conflictingOperation: activeOp,
                    severity: 'high'
                });
            }
        }
        
        // Check for shared resource conflicts
        const worktreeContext = this.worktreeContexts.get(operation.worktreePath);
        if (worktreeContext) {
            for (const resource of worktreeContext.resources) {
                const resourceUsage = this.sharedResources.get(resource);
                if (resourceUsage && resourceUsage.exclusiveUsers.length > 0) {
                    conflicts.push({
                        type: 'shared_resource_conflict',
                        resource,
                        operation: operation,
                        severity: 'medium'
                    });
                }
            }
        }
        
        if (conflicts.length > 0) {
            this.stats.conflictsDetected++;
            console.log(`Detected ${conflicts.length} conflicts for operation ${operation.id}`);
        }
        
        return conflicts;
    }
    
    /**
     * Resolve conflicts for operation
     */
    async resolveConflicts(conflicts, operation) {
        console.log(`Resolving ${conflicts.length} conflicts for operation ${operation.id}`);
        
        for (const conflict of conflicts) {
            switch (conflict.type) {
                case 'concurrent_git_operation':
                    await this.resolveConcurrentGitConflict(conflict, operation);
                    break;
                    
                case 'shared_resource_conflict':
                    await this.resolveSharedResourceConflict(conflict, operation);
                    break;
                    
                default:
                    console.warn(`Unknown conflict type: ${conflict.type}`);
            }
        }
        
        this.stats.conflictsResolved++;
        
        // Record conflict resolution
        this.recordConflictResolution(conflicts, operation);
    }
    
    /**
     * Resolve concurrent git operation conflict
     */
    async resolveConcurrentGitConflict(conflict, operation) {
        // Wait for the conflicting operation to complete
        const conflictingOp = conflict.conflictingOperation;
        
        console.log(`Waiting for conflicting git operation ${conflictingOp.id} to complete`);
        
        // Simple approach: wait with timeout
        const maxWaitTime = this.config.conflictTimeoutMs;
        const startTime = Date.now();
        
        while (this.activeOperations.has(conflictingOp.id) && 
               (Date.now() - startTime) < maxWaitTime) {
            
            await this.sleep(this.config.retryDelayMs);
        }
        
        if (this.activeOperations.has(conflictingOp.id)) {
            throw new Error(`Timeout waiting for conflicting git operation to complete`);
        }
        
        console.log(`Conflicting git operation ${conflictingOp.id} completed, proceeding`);
    }
    
    /**
     * Resolve shared resource conflict
     */
    async resolveSharedResourceConflict(conflict, operation) {
        const resource = conflict.resource;
        
        console.log(`Resolving shared resource conflict for: ${resource}`);
        
        // Release exclusive access if needed
        const resourceUsage = this.sharedResources.get(resource);
        if (resourceUsage) {
            // Simple approach: wait for resource to become available
            while (resourceUsage.exclusiveUsers.length > 0) {
                await this.sleep(this.config.retryDelayMs);
            }
        }
        
        console.log(`Shared resource ${resource} is now available`);
    }
    
    /**
     * Complete operation successfully
     */
    completeOperation(operation, result) {
        // Remove from active operations
        this.activeOperations.delete(operation.id);
        
        // Update worktree context
        const context = this.worktreeContexts.get(operation.worktreePath);
        if (context) {
            context.operations.delete(operation.id);
        }
        
        console.log(`Completed git operation ${operation.id}: ${operation.command}`);
        
        // Resolve the promise
        operation.resolve(result);
        
        this.emit('operationCompleted', {
            operation,
            result,
            duration: Date.now() - operation.queuedAt
        });
    }
    
    /**
     * Handle operation failure with retry logic
     */
    async handleOperationFailure(operation, error) {
        console.error(`Git operation ${operation.id} failed:`, error.message);
        
        // Check if we should retry
        if (operation.retryCount < this.config.maxRetries && this.isRetryableError(error)) {
            operation.retryCount++;
            this.stats.retryAttempts++;
            
            console.log(`Retrying git operation ${operation.id} (attempt ${operation.retryCount}/${this.config.maxRetries})`);
            
            // Add back to queue with delay
            setTimeout(() => {
                this.gitOperationQueue.unshift(operation);
                this.processGitOperationQueue();
            }, this.config.retryDelayMs * operation.retryCount);
            
        } else {
            // Maximum retries reached or non-retryable error
            this.activeOperations.delete(operation.id);
            
            const context = this.worktreeContexts.get(operation.worktreePath);
            if (context) {
                context.operations.delete(operation.id);
            }
            
            console.error(`Git operation ${operation.id} failed permanently after ${operation.retryCount} retries`);
            
            operation.reject(error);
            
            this.emit('operationFailed', {
                operation,
                error,
                retryCount: operation.retryCount
            });
        }
    }
    
    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        const retryablePatterns = [
            /lock.*exists/i,
            /unable to lock/i,
            /resource temporarily unavailable/i,
            /device or resource busy/i
        ];
        
        return retryablePatterns.some(pattern => pattern.test(error.message));
    }
    
    /**
     * Check if two worktrees share the same repository
     */
    isSharedRepository(path1, path2) {
        // Simple implementation: check if they're in same git repository
        // In a real implementation, this would check .git directory paths
        return this.getRepositoryRoot(path1) === this.getRepositoryRoot(path2);
    }
    
    /**
     * Get repository root for a worktree path
     */
    getRepositoryRoot(worktreePath) {
        // Simplified implementation
        // In reality, this would walk up the directory tree to find .git
        return path.dirname(worktreePath);
    }
    
    /**
     * Create isolated path for worktree resources
     */
    createIsolatedPath(worktreePath, resourceType) {
        const baseName = path.basename(worktreePath);
        return path.join(worktreePath, '.taskmaster', 'worktree-isolation', resourceType);
    }
    
    /**
     * Cancel all operations for a worktree
     */
    cancelWorktreeOperations(worktreePath) {
        const opsToCancel = [];
        
        for (const [opId, operation] of this.activeOperations) {
            if (operation.worktreePath === worktreePath) {
                opsToCancel.push(opId);
            }
        }
        
        for (const opId of opsToCancel) {
            const operation = this.activeOperations.get(opId);
            this.activeOperations.delete(opId);
            
            operation.reject(new Error(`Operation cancelled due to worktree unregistration`));
            
            console.log(`Cancelled operation ${opId} for worktree ${worktreePath}`);
        }
    }
    
    /**
     * Release shared resources for a worktree
     */
    releaseWorktreeResources(worktreePath) {
        const context = this.worktreeContexts.get(worktreePath);
        if (!context) {
            return;
        }
        
        for (const resource of context.resources) {
            const usage = this.sharedResources.get(resource);
            if (usage) {
                usage.users.delete(worktreePath);
                usage.exclusiveUsers = usage.exclusiveUsers.filter(path => path !== worktreePath);
                
                if (usage.users.size === 0) {
                    this.sharedResources.delete(resource);
                }
            }
        }
        
        console.log(`Released shared resources for worktree: ${worktreePath}`);
    }
    
    /**
     * Record conflict resolution for analysis
     */
    recordConflictResolution(conflicts, operation) {
        const resolution = {
            timestamp: Date.now(),
            operationId: operation.id,
            conflicts: conflicts.map(c => ({
                type: c.type,
                severity: c.severity
            })),
            resolutionTime: Date.now() - operation.queuedAt
        };
        
        this.conflictHistory.push(resolution);
        
        // Maintain history size
        if (this.conflictHistory.length > 1000) {
            this.conflictHistory = this.conflictHistory.slice(-500);
        }
    }
    
    /**
     * Generate unique operation ID
     */
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get coordination statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            registeredWorktrees: this.worktreeContexts.size,
            activeOperations: this.activeOperations.size,
            queuedOperations: this.gitOperationQueue.length,
            sharedResources: this.sharedResources.size,
            activeConflicts: this.activeConflicts.size,
            conflictHistory: this.conflictHistory.length,
            uptime: Date.now() - this.stats.startTime,
            successRate: this.stats.operationsCompleted > 0 ? 
                (this.stats.operationsCompleted / (this.stats.operationsCompleted + this.stats.conflictsDetected)) * 100 : 100
        };
    }
    
    /**
     * Get worktree contexts
     */
    getWorktreeContexts() {
        return Array.from(this.worktreeContexts.entries()).map(([path, context]) => ({
            path,
            registeredAt: context.registeredAt,
            activeOperations: context.operations.size,
            sharedResources: context.resources.size,
            watcherId: context.watcherId
        }));
    }
}

export default WorktreeCoordinator; 