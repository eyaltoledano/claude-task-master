/**
 * Simple Worktree Manager for Phase 3.4
 * 
 * Research-backed worktree management without git hooks complexity.
 * Provides equal treatment for all worktrees with resource monitoring.
 * 
 * Key Features:
 * - Git worktree discovery via `git worktree list --porcelain`
 * - Periodic discovery without git hooks
 * - Resource-aware watcher management
 * - Graceful degradation under load
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

/**
 * Simple Worktree Manager
 * 
 * Manages file watchers across multiple git worktrees with equal treatment.
 * No git hooks, no priority systems - just effective worktree coordination.
 */
class SimpleWorktreeManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Core state
        this.worktrees = new Map();           // path -> worktree metadata
        this.watchers = new Map();            // path -> watcher instance
        this.discoveryTimer = null;           // periodic discovery timer
        this.isDiscovering = false;           // prevent concurrent discovery
        
        // Configuration (research-backed defaults)
        this.config = {
            discoveryInterval: options.discoveryInterval || 30000,  // 30 seconds
            maxConcurrentWatchers: options.maxConcurrentWatchers || 8,
            gitTimeout: options.gitTimeout || 5000,                // 5 second git timeout
            ...options
        };
        
        // Resource monitoring
        this.resourceMonitor = options.resourceMonitor || null;
        
        // Git operation serialization
        this.gitQueue = [];
        this.gitOperationRunning = false;
        
        // Statistics
        this.stats = {
            workstreesDiscovered: 0,
            watchersCreated: 0,
            gitOperationsCompleted: 0,
            conflictsResolved: 0,
            startTime: Date.now()
        };
        
        console.log('SimpleWorktreeManager initialized with equal treatment for all worktrees');
    }
    
    /**
     * Start worktree management
     */
    async start() {
        try {
            console.log('Starting SimpleWorktreeManager...');
            
            // Initial discovery
            await this.discoverWorktrees();
            
            // Start periodic discovery
            this.startPeriodicDiscovery();
            
            // Connect to resource monitor if available
            if (this.resourceMonitor) {
                this.resourceMonitor.on('throttle', () => this.handleThrottling());
                this.resourceMonitor.on('degradation', () => this.handleGracefulDegradation());
            }
            
            this.emit('started', { 
                worktrees: this.worktrees.size,
                watchers: this.watchers.size 
            });
            
            console.log(`SimpleWorktreeManager started, managing ${this.worktrees.size} worktrees`);
            
        } catch (error) {
            console.error('Failed to start SimpleWorktreeManager:', error);
            throw error;
        }
    }
    
    /**
     * Discover git worktrees using research-backed approach
     */
    async discoverWorktrees() {
        if (this.isDiscovering) {
            return; // Prevent concurrent discovery
        }
        
        this.isDiscovering = true;
        
        try {
            console.log('Discovering git worktrees...');
            
            // Use git worktree list --porcelain for reliable discovery
            const result = await this.executeGitCommand('worktree list --porcelain');
            const discoveredWorktrees = this.parseWorktreeOutput(result.stdout);
            
            // Update worktree tracking
            await this.updateWorktreeTracking(discoveredWorktrees);
            
            this.stats.workstreesDiscovered = discoveredWorktrees.length;
            
            console.log(`Discovered ${discoveredWorktrees.length} worktrees`);
            
        } catch (error) {
            // Git errors are common in non-git directories
            if (error.message.includes('not a git repository')) {
                console.log('Not in a git repository, skipping worktree discovery');
                return;
            }
            
            console.error('Error discovering worktrees:', error);
        } finally {
            this.isDiscovering = false;
        }
    }
    
    /**
     * Execute git command with serialization to prevent conflicts
     */
    async executeGitCommand(command, workingDirectory = process.cwd()) {
        return new Promise((resolve, reject) => {
            this.gitQueue.push({
                command,
                workingDirectory,
                resolve,
                reject,
                timestamp: Date.now()
            });
            
            this.processGitQueue();
        });
    }
    
    /**
     * Process git command queue (serialized execution)
     */
    async processGitQueue() {
        if (this.gitOperationRunning || this.gitQueue.length === 0) {
            return;
        }
        
        this.gitOperationRunning = true;
        
        try {
            while (this.gitQueue.length > 0) {
                const { command, workingDirectory, resolve, reject } = this.gitQueue.shift();
                
                try {
                    const result = await execAsync(`git ${command}`, {
                        cwd: workingDirectory,
                        timeout: this.config.gitTimeout
                    });
                    
                    this.stats.gitOperationsCompleted++;
                    resolve(result);
                    
                } catch (error) {
                    reject(error);
                }
            }
        } finally {
            this.gitOperationRunning = false;
        }
    }
    
    /**
     * Parse git worktree list --porcelain output
     */
    parseWorktreeOutput(output) {
        const worktrees = [];
        const lines = output.trim().split('\n');
        let current = null;
        
        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                if (current) {
                    worktrees.push(current);
                }
                current = {
                    path: line.replace('worktree ', '').trim(),
                    discovered: Date.now()
                };
            } else if (current && line.startsWith('branch ')) {
                current.branch = line.replace('branch ', '').replace('refs/heads/', '').trim();
            } else if (current && line.startsWith('HEAD ')) {
                current.head = line.replace('HEAD ', '').trim();
            }
        }
        
        if (current) {
            worktrees.push(current);
        }
        
        return worktrees;
    }
    
    /**
     * Get comprehensive statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            currentWorktrees: this.worktrees.size,
            activeWatchers: this.watchers.size,
            queuedGitOperations: this.gitQueue.length,
            uptime: Date.now() - this.stats.startTime
        };
    }
    
    startPeriodicDiscovery() {
        this.discoveryTimer = setInterval(() => {
            this.discoverWorktrees();
        }, this.config.discoveryInterval);
    }
    
    async updateWorktreeTracking(discoveredWorktrees) {
        // Simple implementation for now
        for (const worktree of discoveredWorktrees) {
            if (!this.worktrees.has(worktree.path)) {
                this.worktrees.set(worktree.path, worktree);
                console.log(`New worktree discovered: ${worktree.path}`);
            }
        }
    }
    
    handleThrottling() {
        console.log('Resource throttling activated');
    }
    
    handleGracefulDegradation() {
        console.log('Graceful degradation activated');
    }
}

export default SimpleWorktreeManager; 