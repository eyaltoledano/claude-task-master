import { getSyncService } from '../services/sync-service.js';
import { createSyncCommand } from '../../app/commands/sync-command.js';

/**
 * Sync Status Monitor - Utilities for monitoring and displaying sync status
 */
export class SyncStatusMonitor {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.options = {
      refreshInterval: 5000,
      enableNotifications: true,
      ...options
    };
    this.listeners = new Set();
    this.currentStatus = null;
    this.isMonitoring = false;
    this.intervalId = null;
  }

  /**
   * Start monitoring sync status
   */
  async startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    await this.refreshStatus();
    
    this.intervalId = setInterval(async () => {
      await this.refreshStatus();
    }, this.options.refreshInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Add status change listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Get current status without monitoring
   */
  async getStatus() {
    const syncCmd = createSyncCommand(this.projectRoot);
    return await syncCmd.getStatus();
  }

  /**
   * Refresh status and notify listeners
   */
  async refreshStatus() {
    try {
      const newStatus = await this.getStatus();
      const hasChanged = this._hasStatusChanged(this.currentStatus, newStatus);
      
      this.currentStatus = newStatus;
      
      if (hasChanged) {
        this._notifyListeners(newStatus);
      }
      
      return newStatus;
    } catch (error) {
      console.warn('Failed to refresh sync status:', error.message);
      return null;
    }
  }

  /**
   * Format status for display
   */
  formatStatus(status = this.currentStatus) {
    if (!status) return 'Status unavailable';
    
    const parts = [];
    
    // Basic status
    if (status.dbExists && status.jsonExists) {
      parts.push('🔄 Both sources available');
    } else if (status.dbExists) {
      parts.push('🗄️ Database only');
    } else if (status.jsonExists) {
      parts.push('📄 JSON only');
    } else {
      parts.push('❌ No sources');
    }
    
    // Conflicts
    if (status.conflictsCount > 0) {
      parts.push(`⚠️ ${status.conflictsCount} conflicts`);
    } else {
      parts.push('✅ No conflicts');
    }
    
    // Last sync
    if (status.lastSync) {
      const lastSyncDate = new Date(status.lastSync);
      const timeDiff = Date.now() - lastSyncDate.getTime();
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      
      if (hoursAgo < 1) {
        parts.push('🕐 Recently synced');
      } else if (hoursAgo < 24) {
        parts.push(`🕐 Synced ${hoursAgo}h ago`);
      } else {
        parts.push('🕐 Sync outdated');
      }
    } else {
      parts.push('🕐 Never synced');
    }
    
    return parts.join(' • ');
  }

  /**
   * Get sync health score (0-100)
   */
  getHealthScore(status = this.currentStatus) {
    if (!status) return 0;
    
    let score = 0;
    
    // Base score for having both sources
    if (status.dbExists && status.jsonExists) {
      score += 40;
    } else if (status.dbExists || status.jsonExists) {
      score += 20;
    }
    
    // Conflict penalty
    if (status.conflictsCount === 0) {
      score += 30;
    } else {
      score += Math.max(0, 30 - (status.conflictsCount * 5));
    }
    
    // Recency bonus
    if (status.lastSync) {
      const lastSyncDate = new Date(status.lastSync);
      const timeDiff = Date.now() - lastSyncDate.getTime();
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      
      if (hoursAgo < 1) {
        score += 30;
      } else if (hoursAgo < 6) {
        score += 20;
      } else if (hoursAgo < 24) {
        score += 10;
      }
    }
    
    return Math.min(100, Math.max(0, score));
  }

  // Private methods
  _hasStatusChanged(oldStatus, newStatus) {
    if (!oldStatus) return true;
    
    return (
      oldStatus.conflictsCount !== newStatus.conflictsCount ||
      oldStatus.dbExists !== newStatus.dbExists ||
      oldStatus.jsonExists !== newStatus.jsonExists ||
      oldStatus.lastSync !== newStatus.lastSync
    );
  }

  _notifyListeners(status) {
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.warn('Error in sync status listener:', error.message);
      }
    });
  }
}

/**
 * Sync Performance Tracker
 */
export class SyncPerformanceTracker {
  constructor() {
    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageDuration: 0,
      lastSyncDuration: 0,
      totalDuration: 0
    };
    this.recentSyncs = [];
    this.maxRecentSyncs = 10;
  }

  /**
   * Record a sync operation
   */
  recordSync(result) {
    this.metrics.totalSyncs++;
    
    if (result.success) {
      this.metrics.successfulSyncs++;
    } else {
      this.metrics.failedSyncs++;
    }
    
    if (result.duration) {
      this.metrics.lastSyncDuration = result.duration;
      this.metrics.totalDuration += result.duration;
      this.metrics.averageDuration = this.metrics.totalDuration / this.metrics.totalSyncs;
    }
    
    // Track recent syncs
    this.recentSyncs.unshift({
      timestamp: new Date().toISOString(),
      success: result.success,
      duration: result.duration,
      direction: result.direction || result.result?.direction,
      conflicts: result.conflicts?.length || 0
    });
    
    // Keep only recent syncs
    if (this.recentSyncs.length > this.maxRecentSyncs) {
      this.recentSyncs = this.recentSyncs.slice(0, this.maxRecentSyncs);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalSyncs > 0 
        ? (this.metrics.successfulSyncs / this.metrics.totalSyncs) * 100 
        : 0,
      recentSyncs: this.recentSyncs
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageDuration: 0,
      lastSyncDuration: 0,
      totalDuration: 0
    };
    this.recentSyncs = [];
  }
}

/**
 * Utility functions
 */

/**
 * Create a quick sync status summary
 */
export async function getQuickSyncSummary(projectRoot) {
  try {
    const monitor = new SyncStatusMonitor(projectRoot);
    const status = await monitor.getStatus();
    const healthScore = monitor.getHealthScore(status);
    
    return {
      available: true,
      health: healthScore,
      status: monitor.formatStatus(status),
      needsAttention: healthScore < 70 || status.conflictsCount > 0,
      conflictsCount: status.conflictsCount,
      recommendation: getRecommendation(status, healthScore)
    };
  } catch (error) {
    return {
      available: false,
      error: error.message,
      needsAttention: true,
      recommendation: 'Check database configuration'
    };
  }
}

/**
 * Get sync recommendation based on status
 */
export function getRecommendation(status, healthScore) {
  if (!status.dbExists && !status.jsonExists) {
    return 'Initialize database and create tasks.json';
  }
  
  if (!status.dbExists && status.jsonExists) {
    return 'Run: sync --direction json-to-db';
  }
  
  if (status.dbExists && !status.jsonExists) {
    return 'Run: sync --direction db-to-json';
  }
  
  if (status.conflictsCount > 5) {
    return 'Review conflicts and consider force sync';
  }
  
  if (status.conflictsCount > 0) {
    return 'Run: sync --dry-run to preview changes';
  }
  
  if (healthScore < 50) {
    return 'Check sync configuration and recent operations';
  }
  
  if (!status.lastSync) {
    return 'Run initial sync to establish baseline';
  }
  
  const lastSyncDate = new Date(status.lastSync);
  const hoursAgo = Math.floor((Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60));
  
  if (hoursAgo > 24) {
    return 'Consider running sync to update data';
  }
  
  return 'System is in good sync';
}

/**
 * Format sync duration for display
 */
export function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Global instances
 */
const monitors = new Map();
const performanceTracker = new SyncPerformanceTracker();

export function getSyncMonitor(projectRoot, options = {}) {
  if (!monitors.has(projectRoot)) {
    monitors.set(projectRoot, new SyncStatusMonitor(projectRoot, options));
  }
  return monitors.get(projectRoot);
}

export function getGlobalPerformanceTracker() {
  return performanceTracker;
} 