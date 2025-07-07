/**
 * @fileoverview E2B Resource Manager
 * 
 * Manages E2B sandbox resources, tracking lifecycle, metrics, and logs.
 * Provides resource monitoring and cleanup capabilities.
 */

import fs from 'node:fs'
import path from 'node:path'
import { E2BError } from './errors.js'

/**
 * E2B Resource Manager
 * Tracks sandbox resources and their lifecycle
 */
export class E2BResourceManager {
  constructor(config = {}) {
    this.config = config
    this.dataDir = config.dataDir || '.taskmaster/flow/data/e2b'
    this.resources = new Map()
    this.logs = new Map()
    this.metrics = {
      totalCreated: 0,
      totalDestroyed: 0,
      totalExecutions: 0,
      totalErrors: 0,
      currentActive: 0,
      averageLifetime: 0,
      totalCost: 0
    }

    this.ensureDataDirectory()
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDirectory() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true })
      }
    } catch (error) {
      console.warn(`Failed to create E2B data directory: ${error.message}`)
    }
  }

  /**
   * Track a new resource
   */
  async trackResource(resource) {
    try {
      const resourceData = {
        id: resource.id,
        type: resource.type,
        provider: resource.provider,
        status: resource.status,
        template: resource.template,
        createdAt: resource.createdAt,
        config: resource.config,
        metadata: resource.metadata,
        executions: [],
        logs: [],
        metrics: {
          createdAt: Date.now(),
          executionCount: 0,
          lastExecution: null,
          totalExecutionTime: 0,
          errorCount: 0,
          cost: 0
        }
      }

      this.resources.set(resource.id, resourceData)
      this.metrics.totalCreated++
      this.metrics.currentActive++

      await this.saveResourceData(resource.id, resourceData)
      await this.updateMetrics()

      return resourceData
    } catch (error) {
      throw new E2BError({
        code: 'TRACK_RESOURCE_FAILED',
        message: `Failed to track E2B resource: ${error.message}`,
        category: 'resource',
        details: { resourceId: resource.id, originalError: error }
      })
    }
  }

  /**
   * Update resource data
   */
  async updateResource(resourceId, updates) {
    try {
      const resource = this.resources.get(resourceId)
      if (!resource) {
        throw new E2BError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource ${resourceId} not found in manager`,
          category: 'resource'
        })
      }

      const updatedResource = {
        ...resource,
        ...updates,
        updatedAt: new Date().toISOString(),
        metadata: { ...resource.metadata, ...updates.metadata }
      }

      this.resources.set(resourceId, updatedResource)
      await this.saveResourceData(resourceId, updatedResource)

      return updatedResource
    } catch (error) {
      throw new E2BError({
        code: 'UPDATE_RESOURCE_FAILED',
        message: `Failed to update E2B resource: ${error.message}`,
        category: 'resource',
        details: { resourceId, updates, originalError: error }
      })
    }
  }

  /**
   * Untrack a resource
   */
  async untrackResource(resourceId) {
    try {
      const resource = this.resources.get(resourceId)
      if (!resource) {
        return { success: true, message: 'Resource not tracked' }
      }

      // Calculate lifetime
      const lifetime = Date.now() - resource.metrics.createdAt
      this.updateAverageLifetime(lifetime)

      this.resources.delete(resourceId)
      this.logs.delete(resourceId)
      this.metrics.totalDestroyed++
      this.metrics.currentActive = Math.max(0, this.metrics.currentActive - 1)

      await this.removeResourceData(resourceId)
      await this.updateMetrics()

      return {
        success: true,
        resourceId,
        lifetime,
        executions: resource.metrics.executionCount
      }
    } catch (error) {
      throw new E2BError({
        code: 'UNTRACK_RESOURCE_FAILED',
        message: `Failed to untrack E2B resource: ${error.message}`,
        category: 'resource',
        details: { resourceId, originalError: error }
      })
    }
  }

  /**
   * Log execution for a resource
   */
  async logExecution(resourceId, execution) {
    try {
      const resource = this.resources.get(resourceId)
      if (!resource) {
        throw new E2BError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource ${resourceId} not found for execution logging`,
          category: 'resource'
        })
      }

      const executionLog = {
        id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        resourceId,
        timestamp: new Date().toISOString(),
        duration: execution.duration,
        success: execution.exitCode === 0,
        exitCode: execution.exitCode,
        language: execution.language,
        codeLength: execution.code?.length || 0,
        output: execution.output?.substring(0, 1000) || '', // Truncate long output
        error: execution.stderr?.substring(0, 500) || '', // Truncate long errors
        metadata: execution.metadata || {}
      }

      resource.executions.push(executionLog)
      resource.metrics.executionCount++
      resource.metrics.lastExecution = executionLog.timestamp
      resource.metrics.totalExecutionTime += execution.duration || 0

      if (!executionLog.success) {
        resource.metrics.errorCount++
        this.metrics.totalErrors++
      }

      this.metrics.totalExecutions++

      // Keep only last 100 executions per resource
      if (resource.executions.length > 100) {
        resource.executions = resource.executions.slice(-100)
      }

      await this.saveResourceData(resourceId, resource)
      await this.updateMetrics()

      return executionLog
    } catch (error) {
      throw new E2BError({
        code: 'LOG_EXECUTION_FAILED',
        message: `Failed to log E2B execution: ${error.message}`,
        category: 'resource',
        details: { resourceId, execution, originalError: error }
      })
    }
  }

  /**
   * Get resource logs
   */
  async getResourceLogs(resourceId, options = {}) {
    try {
      const resource = this.resources.get(resourceId)
      if (!resource) {
        return []
      }

      let logs = [...resource.logs, ...resource.executions.map(exec => ({
        type: 'execution',
        timestamp: exec.timestamp,
        message: `Execution ${exec.success ? 'completed' : 'failed'} in ${exec.duration}ms`,
        data: exec
      }))]

      // Apply filters
      if (options.level) {
        logs = logs.filter(log => log.level === options.level || log.type === options.level)
      }

      if (options.since) {
        const sinceDate = new Date(options.since)
        logs = logs.filter(log => new Date(log.timestamp) >= sinceDate)
      }

      if (options.recent) {
        logs = logs.slice(-20) // Last 20 logs
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      if (options.limit) {
        logs = logs.slice(0, options.limit)
      }

      return logs
    } catch (error) {
      throw new E2BError({
        code: 'GET_LOGS_FAILED',
        message: `Failed to get E2B resource logs: ${error.message}`,
        category: 'resource',
        details: { resourceId, options, originalError: error }
      })
    }
  }

  /**
   * Add log entry for a resource
   */
  async addResourceLog(resourceId, logEntry) {
    try {
      const resource = this.resources.get(resourceId)
      if (!resource) {
        // Create logs for non-tracked resources
        if (!this.logs.has(resourceId)) {
          this.logs.set(resourceId, [])
        }
        const logs = this.logs.get(resourceId)
        logs.push({
          ...logEntry,
          timestamp: logEntry.timestamp || new Date().toISOString()
        })
        
        // Keep only last 50 logs for non-tracked resources
        if (logs.length > 50) {
          this.logs.set(resourceId, logs.slice(-50))
        }
        return
      }

      const log = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        ...logEntry
      }

      resource.logs.push(log)

      // Keep only last 100 logs per resource
      if (resource.logs.length > 100) {
        resource.logs = resource.logs.slice(-100)
      }

      await this.saveResourceData(resourceId, resource)
    } catch (error) {
      console.warn(`Failed to add E2B resource log: ${error.message}`)
    }
  }

  /**
   * Get all tracked resources
   */
  getTrackedResources() {
    return Array.from(this.resources.values()).map(resource => ({
      id: resource.id,
      type: resource.type,
      provider: resource.provider,
      status: resource.status,
      template: resource.template,
      createdAt: resource.createdAt,
      metrics: resource.metrics,
      metadata: resource.metadata
    }))
  }

  /**
   * Get manager metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      currentActive: this.resources.size,
      provider: 'e2b'
    }
  }

  /**
   * Cleanup old resource data
   */
  async cleanupOldData(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    try {
      const cutoffTime = Date.now() - maxAge
      const resourcesDir = path.join(this.dataDir, 'resources')
      
      if (!fs.existsSync(resourcesDir)) {
        return { cleaned: 0 }
      }

      const files = fs.readdirSync(resourcesDir)
      let cleaned = 0

      for (const file of files) {
        const filePath = path.join(resourcesDir, file)
        const stats = fs.statSync(filePath)
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath)
          cleaned++
        }
      }

      return { cleaned }
    } catch (error) {
      throw new E2BError({
        code: 'CLEANUP_FAILED',
        message: `Failed to cleanup E2B data: ${error.message}`,
        category: 'resource',
        details: { maxAge, originalError: error }
      })
    }
  }

  /**
   * Save resource data to disk
   */
  async saveResourceData(resourceId, data) {
    try {
      const resourcesDir = path.join(this.dataDir, 'resources')
      if (!fs.existsSync(resourcesDir)) {
        fs.mkdirSync(resourcesDir, { recursive: true })
      }

      const filePath = path.join(resourcesDir, `${resourceId}.json`)
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.warn(`Failed to save E2B resource data: ${error.message}`)
    }
  }

  /**
   * Remove resource data from disk
   */
  async removeResourceData(resourceId) {
    try {
      const filePath = path.join(this.dataDir, 'resources', `${resourceId}.json`)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (error) {
      console.warn(`Failed to remove E2B resource data: ${error.message}`)
    }
  }

  /**
   * Update metrics file
   */
  async updateMetrics() {
    try {
      const metricsPath = path.join(this.dataDir, 'metrics.json')
      fs.writeFileSync(metricsPath, JSON.stringify(this.metrics, null, 2))
    } catch (error) {
      console.warn(`Failed to save E2B metrics: ${error.message}`)
    }
  }

  /**
   * Update average lifetime calculation
   */
  updateAverageLifetime(newLifetime) {
    const total = this.metrics.totalDestroyed
    if (total === 0) {
      this.metrics.averageLifetime = newLifetime
    } else {
      this.metrics.averageLifetime = (
        (this.metrics.averageLifetime * (total - 1) + newLifetime) / total
      )
    }
  }

  /**
   * Load existing data from disk
   */
  async loadExistingData() {
    try {
      // Load metrics
      const metricsPath = path.join(this.dataDir, 'metrics.json')
      if (fs.existsSync(metricsPath)) {
        const metricsData = JSON.parse(fs.readFileSync(metricsPath, 'utf8'))
        this.metrics = { ...this.metrics, ...metricsData }
      }

      // Load resources
      const resourcesDir = path.join(this.dataDir, 'resources')
      if (fs.existsSync(resourcesDir)) {
        const files = fs.readdirSync(resourcesDir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            const resourceId = path.basename(file, '.json')
            const filePath = path.join(resourcesDir, file)
            const resourceData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
            this.resources.set(resourceId, resourceData)
          }
        }
      }

      this.metrics.currentActive = this.resources.size
    } catch (error) {
      console.warn(`Failed to load E2B existing data: ${error.message}`)
    }
  }
} 