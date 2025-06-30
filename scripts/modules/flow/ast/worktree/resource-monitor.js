/**
 * Resource Monitor for Phase 3.4
 * 
 * Research-backed performance monitoring and graceful degradation.
 * Tracks CPU, memory, and event rates for file watchers.
 * 
 * Key Features:
 * - Threshold-based alerting
 * - Automatic throttling under load
 * - Graceful degradation to polling
 * - Performance statistics collection
 */

import { EventEmitter } from 'events';
import os from 'os';

/**
 * Resource Monitor
 * 
 * Monitors system resources and file watcher performance.
 * Implements research-backed patterns for graceful degradation.
 */
class ResourceMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration (research-backed thresholds)
        this.config = {
            monitoringInterval: options.monitoringInterval || 5000,     // 5 seconds
            cpuThreshold: options.cpuThreshold || 80,                   // 80% CPU
            memoryThreshold: options.memoryThreshold || 100,            // 100MB memory
            eventRateThreshold: options.eventRateThreshold || 1000,     // 1000 events/sec
            throttleThreshold: options.throttleThreshold || 0.7,        // 70% of limits
            degradationThreshold: options.degradationThreshold || 0.9,  // 90% of limits
            ...options
        };
        
        // Monitoring state
        this.watchers = new Map();          // watcherId -> metrics
        this.systemMetrics = {};            // Overall system metrics
        this.alertState = {
            throttling: false,
            degradation: false,
            lastAlert: null
        };
        
        // Performance history
        this.metricsHistory = [];
        this.maxHistorySize = 100;          // Keep last 100 measurements
        
        // Monitoring timer
        this.monitoringTimer = null;
        this.isMonitoring = false;
        
        console.log('ResourceMonitor initialized with research-backed thresholds');
    }
    
    /**
     * Start resource monitoring
     */
    start() {
        if (this.isMonitoring) {
            return;
        }
        
        console.log('Starting resource monitoring...');
        
        this.isMonitoring = true;
        this.monitoringTimer = setInterval(() => {
            this.collectMetrics();
        }, this.config.monitoringInterval);
        
        // Initial metrics collection
        this.collectMetrics();
        
        this.emit('started', {
            interval: this.config.monitoringInterval,
            thresholds: this.config
        });
        
        console.log(`Resource monitoring started (${this.config.monitoringInterval}ms interval)`);
    }
    
    /**
     * Stop resource monitoring
     */
    stop() {
        if (!this.isMonitoring) {
            return;
        }
        
        console.log('Stopping resource monitoring...');
        
        this.isMonitoring = false;
        
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        this.emit('stopped');
        console.log('Resource monitoring stopped');
    }
    
    /**
     * Register a watcher for monitoring
     */
    registerWatcher(watcherId, metadata = {}) {
        this.watchers.set(watcherId, {
            id: watcherId,
            ...metadata,
            registeredAt: Date.now(),
            metrics: {
                cpuPercent: 0,
                memoryMB: 0,
                eventRate: 0,
                eventsProcessed: 0,
                errors: 0
            },
            status: 'active'
        });
        
        console.log(`Registered watcher for monitoring: ${watcherId}`);
        
        this.emit('watcherRegistered', { watcherId, metadata });
    }
    
    /**
     * Unregister a watcher from monitoring
     */
    unregisterWatcher(watcherId) {
        const watcher = this.watchers.get(watcherId);
        if (!watcher) {
            return;
        }
        
        this.watchers.delete(watcherId);
        
        console.log(`Unregistered watcher from monitoring: ${watcherId}`);
        
        this.emit('watcherUnregistered', { watcherId, watcher });
    }
    
    /**
     * Update watcher metrics
     */
    updateWatcherMetrics(watcherId, metrics) {
        const watcher = this.watchers.get(watcherId);
        if (!watcher) {
            console.warn(`Attempt to update metrics for unknown watcher: ${watcherId}`);
            return;
        }
        
        // Update metrics with timestamp
        watcher.metrics = {
            ...watcher.metrics,
            ...metrics,
            lastUpdated: Date.now()
        };
        
        this.watchers.set(watcherId, watcher);
        
        // Check if this update triggers any thresholds
        this.checkWatcherThresholds(watcherId, watcher);
    }
    
    /**
     * Collect system and watcher metrics
     */
    collectMetrics() {
        try {
            // Collect system metrics
            const systemMetrics = this.collectSystemMetrics();
            this.systemMetrics = systemMetrics;
            
            // Collect aggregate watcher metrics
            const aggregateMetrics = this.collectAggregateWatcherMetrics();
            
            // Combined metrics for analysis
            const combinedMetrics = {
                timestamp: Date.now(),
                system: systemMetrics,
                watchers: aggregateMetrics,
                watcherCount: this.watchers.size
            };
            
            // Add to history
            this.addToHistory(combinedMetrics);
            
            // Check overall thresholds
            this.checkOverallThresholds(combinedMetrics);
            
            this.emit('metricsCollected', combinedMetrics);
            
        } catch (error) {
            console.error('Error collecting metrics:', error);
            this.emit('metricsError', error);
        }
    }
    
    /**
     * Collect system-level metrics
     */
    collectSystemMetrics() {
        const cpuUsage = os.loadavg()[0] / os.cpus().length * 100; // 1-minute load average
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryPercent = (usedMemory / totalMemory) * 100;
        
        return {
            cpu: {
                usage: Math.min(cpuUsage, 100), // Cap at 100%
                cores: os.cpus().length
            },
            memory: {
                total: Math.round(totalMemory / 1024 / 1024), // MB
                used: Math.round(usedMemory / 1024 / 1024),   // MB
                free: Math.round(freeMemory / 1024 / 1024),   // MB
                percent: memoryPercent
            },
            uptime: os.uptime()
        };
    }
    
    /**
     * Collect aggregate watcher metrics
     */
    collectAggregateWatcherMetrics() {
        if (this.watchers.size === 0) {
            return {
                totalCpuPercent: 0,
                totalMemoryMB: 0,
                totalEventRate: 0,
                totalEventsProcessed: 0,
                totalErrors: 0,
                activeWatchers: 0
            };
        }
        
        let totalCpu = 0;
        let totalMemory = 0;
        let totalEventRate = 0;
        let totalEvents = 0;
        let totalErrors = 0;
        let activeCount = 0;
        
        for (const watcher of this.watchers.values()) {
            if (watcher.status === 'active') {
                totalCpu += watcher.metrics.cpuPercent || 0;
                totalMemory += watcher.metrics.memoryMB || 0;
                totalEventRate += watcher.metrics.eventRate || 0;
                totalEvents += watcher.metrics.eventsProcessed || 0;
                totalErrors += watcher.metrics.errors || 0;
                activeCount++;
            }
        }
        
        return {
            totalCpuPercent: totalCpu,
            totalMemoryMB: totalMemory,
            totalEventRate: totalEventRate,
            totalEventsProcessed: totalEvents,
            totalErrors: totalErrors,
            activeWatchers: activeCount,
            averageCpuPercent: activeCount > 0 ? totalCpu / activeCount : 0,
            averageMemoryMB: activeCount > 0 ? totalMemory / activeCount : 0
        };
    }
    
    /**
     * Check individual watcher thresholds
     */
    checkWatcherThresholds(watcherId, watcher) {
        const metrics = watcher.metrics;
        
        // Check individual watcher limits (per research findings)
        if (metrics.cpuPercent > 15) { // 15% per watcher limit
            this.emit('watcherAlert', {
                watcherId,
                type: 'cpu',
                value: metrics.cpuPercent,
                threshold: 15
            });
        }
        
        if (metrics.memoryMB > 50) { // 50MB per watcher limit
            this.emit('watcherAlert', {
                watcherId,
                type: 'memory',
                value: metrics.memoryMB,
                threshold: 50
            });
        }
        
        if (metrics.eventRate > 1000) { // 1000 events/sec per watcher
            this.emit('watcherAlert', {
                watcherId,
                type: 'eventRate',
                value: metrics.eventRate,
                threshold: 1000
            });
        }
    }
    
    /**
     * Check overall system thresholds
     */
    checkOverallThresholds(metrics) {
        const system = metrics.system;
        const watchers = metrics.watchers;
        
        // Calculate utilization percentages
        const cpuUtilization = system.cpu.usage / 100;
        const memoryUtilization = system.memory.percent / 100;
        const watcherLoadFactor = Math.max(
            watchers.totalCpuPercent / (15 * watchers.activeWatchers || 1),
            watchers.totalMemoryMB / (50 * watchers.activeWatchers || 1)
        );
        
        // Check for throttling threshold (research-backed 70%)
        if (!this.alertState.throttling && 
            (cpuUtilization > this.config.throttleThreshold || 
             memoryUtilization > this.config.throttleThreshold ||
             watcherLoadFactor > this.config.throttleThreshold)) {
            
            this.triggerThrottling(metrics);
        }
        
        // Check for degradation threshold (research-backed 90%)
        if (!this.alertState.degradation && 
            (cpuUtilization > this.config.degradationThreshold || 
             memoryUtilization > this.config.degradationThreshold ||
             watcherLoadFactor > this.config.degradationThreshold)) {
            
            this.triggerGracefulDegradation(metrics);
        }
        
        // Recovery checks
        if (this.alertState.throttling && 
            cpuUtilization < this.config.throttleThreshold * 0.8 &&
            memoryUtilization < this.config.throttleThreshold * 0.8 &&
            watcherLoadFactor < this.config.throttleThreshold * 0.8) {
            
            this.recoverFromThrottling(metrics);
        }
    }
    
    /**
     * Trigger throttling mode
     */
    triggerThrottling(metrics) {
        console.log('🚦 Resource throttling triggered');
        
        this.alertState.throttling = true;
        this.alertState.lastAlert = Date.now();
        
        this.emit('throttle', {
            reason: 'resource_threshold_exceeded',
            metrics,
            timestamp: Date.now()
        });
    }
    
    /**
     * Trigger graceful degradation
     */
    triggerGracefulDegradation(metrics) {
        console.log('🔄 Graceful degradation triggered - switching to polling mode');
        
        this.alertState.degradation = true;
        this.alertState.lastAlert = Date.now();
        
        this.emit('degradation', {
            reason: 'critical_resource_usage',
            metrics,
            fallbackMode: 'polling',
            timestamp: Date.now()
        });
    }
    
    /**
     * Recover from throttling
     */
    recoverFromThrottling(metrics) {
        console.log('✅ Recovered from resource throttling');
        
        this.alertState.throttling = false;
        
        this.emit('recovery', {
            from: 'throttling',
            metrics,
            timestamp: Date.now()
        });
    }
    
    /**
     * Add metrics to history
     */
    addToHistory(metrics) {
        this.metricsHistory.push(metrics);
        
        // Maintain history size limit
        if (this.metricsHistory.length > this.maxHistorySize) {
            this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
        }
    }
    
    /**
     * Get current resource status
     */
    getResourceStatus() {
        return {
            monitoring: this.isMonitoring,
            watchers: this.watchers.size,
            alertState: this.alertState,
            systemMetrics: this.systemMetrics,
            thresholds: this.config,
            uptime: this.isMonitoring ? Date.now() - (this.metricsHistory[0]?.timestamp || Date.now()) : 0
        };
    }
    
    /**
     * Get performance statistics
     */
    getStatistics() {
        const recentMetrics = this.metricsHistory.slice(-10); // Last 10 measurements
        
        if (recentMetrics.length === 0) {
            return {
                averageCpu: 0,
                averageMemory: 0,
                peakCpu: 0,
                peakMemory: 0,
                alertCount: 0,
                measurementCount: 0,
                watchersTracked: this.watchers.size
            };
        }
        
        const cpuValues = recentMetrics.map(m => m.system.cpu.usage);
        const memoryValues = recentMetrics.map(m => m.system.memory.percent);
        
        return {
            averageCpu: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
            averageMemory: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
            peakCpu: Math.max(...cpuValues),
            peakMemory: Math.max(...memoryValues),
            alertCount: this.alertState.lastAlert ? 1 : 0,
            measurementCount: recentMetrics.length,
            watchersTracked: this.watchers.size
        };
    }
}

export default ResourceMonitor; 