/**
 * Phase 3.4: Worktree Manager Integration
 * 
 * Unified integration of worktree management components.
 * Simple, effective approach without git hooks complexity.
 * 
 * Components:
 * - SimpleWorktreeManager: Git worktree discovery and watcher management
 * - ResourceMonitor: Performance monitoring and graceful degradation  
 * - WorktreeCoordinator: Cross-worktree coordination and conflict resolution
 */

import SimpleWorktreeManager from './simple-worktree-manager.js';
import ResourceMonitor from './resource-monitor.js';
import WorktreeCoordinator from './worktree-coordinator.js';
import { EventEmitter } from 'events';

/**
 * Integrated Worktree Management System
 * 
 * Combines all Phase 3.4 components into a unified system.
 * Research-backed approach with equal treatment for all worktrees.
 */
class IntegratedWorktreeManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration with research-backed defaults
        this.config = {
            enabled: options.enabled !== false,
            autoStart: options.autoStart !== false,
            ...options
        };
        
        // Initialize components
        this.resourceMonitor = new ResourceMonitor(options.resourceMonitor);
        this.coordinator = new WorktreeCoordinator(options.coordinator);
        this.worktreeManager = new SimpleWorktreeManager({
            ...options.worktreeManager,
            resourceMonitor: this.resourceMonitor
        });
        
        // Integration state
        this.isStarted = false;
        this.integrationMetrics = {
            startTime: null,
            worktreeEvents: 0,
            resourceEvents: 0,
            coordinationEvents: 0
        };
        
        // Wire up component events
        this.setupComponentIntegration();
        
        console.log('IntegratedWorktreeManager initialized');
    }
    
    /**
     * Setup integration between components
     */
    setupComponentIntegration() {
        // Resource Monitor -> Worktree Manager integration
        this.resourceMonitor.on('throttle', (data) => {
            this.worktreeManager.handleThrottling();
            this.integrationMetrics.resourceEvents++;
            this.emit('systemThrottling', data);
        });
        
        this.resourceMonitor.on('degradation', (data) => {
            this.worktreeManager.handleGracefulDegradation();
            this.integrationMetrics.resourceEvents++;
            this.emit('systemDegradation', data);
        });
        
        // Worktree Manager -> Coordinator integration
        this.worktreeManager.on('worktreeAdded', (worktree) => {
            this.coordinator.registerWorktree(worktree.path, worktree);
            this.integrationMetrics.worktreeEvents++;
            this.emit('worktreeIntegrated', worktree);
        });
        
        this.worktreeManager.on('worktreeRemoved', (worktree) => {
            this.coordinator.unregisterWorktree(worktree.path);
            this.integrationMetrics.worktreeEvents++;
            this.emit('worktreeRemoved', worktree);
        });
        
        // Worktree Manager -> Resource Monitor integration
        this.worktreeManager.on('watcherCreated', (data) => {
            this.resourceMonitor.registerWatcher(data.watcherId, {
                worktreePath: data.worktreePath,
                type: 'worktree_watcher'
            });
            this.integrationMetrics.worktreeEvents++;
        });
        
        // Coordinator -> Resource Monitor integration
        this.coordinator.on('operationCompleted', (data) => {
            // Update resource metrics based on operation completion
            this.integrationMetrics.coordinationEvents++;
        });
        
        this.coordinator.on('operationFailed', (data) => {
            console.warn(`Git operation failed in worktree coordination: ${data.error.message}`);
            this.integrationMetrics.coordinationEvents++;
        });
        
        console.log('Component integration configured');
    }
    
    /**
     * Start the integrated worktree management system
     */
    async start() {
        if (this.isStarted) {
            console.log('IntegratedWorktreeManager already started');
            return;
        }
        
        if (!this.config.enabled) {
            console.log('IntegratedWorktreeManager disabled via configuration');
            return;
        }
        
        try {
            console.log('Starting IntegratedWorktreeManager...');
            
            this.integrationMetrics.startTime = Date.now();
            
            // Start components in order
            this.resourceMonitor.start();
            await this.worktreeManager.start();
            
            this.isStarted = true;
            
            this.emit('started', {
                components: ['resourceMonitor', 'worktreeManager', 'coordinator'],
                worktrees: this.worktreeManager.getStatistics().currentWorktrees
            });
            
            console.log('IntegratedWorktreeManager started successfully');
            
        } catch (error) {
            console.error('Failed to start IntegratedWorktreeManager:', error);
            throw error;
        }
    }
    
    /**
     * Stop the integrated worktree management system
     */
    async stop() {
        if (!this.isStarted) {
            return;
        }
        
        try {
            console.log('Stopping IntegratedWorktreeManager...');
            
            // Stop components in reverse order
            if (this.worktreeManager.stop) {
                await this.worktreeManager.stop();
            }
            this.resourceMonitor.stop();
            
            this.isStarted = false;
            
            this.emit('stopped');
            console.log('IntegratedWorktreeManager stopped');
            
        } catch (error) {
            console.error('Error stopping IntegratedWorktreeManager:', error);
            throw error;
        }
    }
    
    /**
     * Execute git command with full coordination
     */
    async executeGitCommand(command, worktreePath, options = {}) {
        if (!this.isStarted) {
            throw new Error('IntegratedWorktreeManager not started');
        }
        
        return this.coordinator.executeGitCommand(command, worktreePath, options);
    }
    
    /**
     * Get comprehensive system status
     */
    getSystemStatus() {
        return {
            enabled: this.config.enabled,
            started: this.isStarted,
            uptime: this.integrationMetrics.startTime ? Date.now() - this.integrationMetrics.startTime : 0,
            components: {
                worktreeManager: {
                    status: 'active',
                    ...this.worktreeManager.getStatistics()
                },
                resourceMonitor: {
                    status: this.resourceMonitor.isMonitoring ? 'active' : 'inactive',
                    ...this.resourceMonitor.getResourceStatus()
                },
                coordinator: {
                    status: 'active',
                    ...this.coordinator.getStatistics()
                }
            },
            integration: {
                ...this.integrationMetrics,
                eventsPerMinute: this.calculateEventsPerMinute()
            }
        };
    }
    
    /**
     * Get all discovered worktrees
     */
    getWorktrees() {
        return this.worktreeManager.getWorktrees();
    }
    
    /**
     * Get worktree coordination contexts
     */
    getWorktreeContexts() {
        return this.coordinator.getWorktreeContexts();
    }
    
    /**
     * Get performance statistics
     */
    getPerformanceStatistics() {
        return {
            worktreeManager: this.worktreeManager.getStatistics(),
            resourceMonitor: this.resourceMonitor.getStatistics(),
            coordinator: this.coordinator.getStatistics(),
            integration: this.integrationMetrics
        };
    }
    
    /**
     * Calculate events per minute for integration health
     */
    calculateEventsPerMinute() {
        if (!this.integrationMetrics.startTime) {
            return 0;
        }
        
        const uptimeMinutes = (Date.now() - this.integrationMetrics.startTime) / (1000 * 60);
        const totalEvents = this.integrationMetrics.worktreeEvents + 
                           this.integrationMetrics.resourceEvents + 
                           this.integrationMetrics.coordinationEvents;
        
        return uptimeMinutes > 0 ? Math.round(totalEvents / uptimeMinutes) : 0;
    }
    
    /**
     * Health check for the integrated system
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            timestamp: Date.now(),
            components: {},
            issues: []
        };
        
        // Check worktree manager health
        try {
            const wtStats = this.worktreeManager.getStatistics();
            health.components.worktreeManager = {
                status: 'healthy',
                worktrees: wtStats.currentWorktrees,
                watchers: wtStats.activeWatchers
            };
        } catch (error) {
            health.status = 'degraded';
            health.issues.push(`Worktree manager error: ${error.message}`);
            health.components.worktreeManager = { status: 'error', error: error.message };
        }
        
        // Check resource monitor health
        try {
            const resourceStatus = this.resourceMonitor.getResourceStatus();
            health.components.resourceMonitor = {
                status: resourceStatus.alertState.degradation ? 'degraded' : 'healthy',
                monitoring: resourceStatus.monitoring,
                alerts: resourceStatus.alertState
            };
            
            if (resourceStatus.alertState.degradation) {
                health.status = 'degraded';
                health.issues.push('System in graceful degradation mode');
            }
        } catch (error) {
            health.status = 'degraded';
            health.issues.push(`Resource monitor error: ${error.message}`);
            health.components.resourceMonitor = { status: 'error', error: error.message };
        }
        
        // Check coordinator health
        try {
            const coordStats = this.coordinator.getStatistics();
            health.components.coordinator = {
                status: 'healthy',
                activeOperations: coordStats.activeOperations,
                successRate: coordStats.successRate
            };
            
            if (coordStats.successRate < 90) {
                health.status = 'degraded';
                health.issues.push(`Low coordination success rate: ${coordStats.successRate}%`);
            }
        } catch (error) {
            health.status = 'degraded';
            health.issues.push(`Coordinator error: ${error.message}`);
            health.components.coordinator = { status: 'error', error: error.message };
        }
        
        return health;
    }
}

/**
 * Factory function for creating integrated worktree manager
 */
export function createWorktreeManager(options = {}) {
    return new IntegratedWorktreeManager(options);
}

/**
 * Default configuration presets
 */
export const WORKTREE_PRESETS = {
    // Conservative preset - safest resource usage
    SAFE: {
        worktreeManager: {
            maxConcurrentWatchers: 4,
            discoveryInterval: 60000  // 1 minute
        },
        resourceMonitor: {
            cpuThreshold: 60,
            memoryThreshold: 75,
            throttleThreshold: 0.6,
            degradationThreshold: 0.8
        },
        coordinator: {
            maxRetries: 5,
            retryDelayMs: 200,
            conflictTimeoutMs: 10000
        }
    },
    
    // Balanced preset - research-backed defaults
    BALANCED: {
        worktreeManager: {
            maxConcurrentWatchers: 8,
            discoveryInterval: 30000  // 30 seconds
        },
        resourceMonitor: {
            cpuThreshold: 80,
            memoryThreshold: 100,
            throttleThreshold: 0.7,
            degradationThreshold: 0.9
        },
        coordinator: {
            maxRetries: 3,
            retryDelayMs: 100,
            conflictTimeoutMs: 5000
        }
    },
    
    // Fast preset - maximum performance
    FAST: {
        worktreeManager: {
            maxConcurrentWatchers: 12,
            discoveryInterval: 15000  // 15 seconds
        },
        resourceMonitor: {
            cpuThreshold: 90,
            memoryThreshold: 150,
            throttleThreshold: 0.8,
            degradationThreshold: 0.95
        },
        coordinator: {
            maxRetries: 2,
            retryDelayMs: 50,
            conflictTimeoutMs: 3000
        }
    }
};

// Export all components
export {
    IntegratedWorktreeManager,
    SimpleWorktreeManager,
    ResourceMonitor,
    WorktreeCoordinator
}; 