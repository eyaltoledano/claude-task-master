/**
 * @fileoverview Daytona API Client
 * 
 * Handles communication with Daytona's API for workspace management.
 * Provides workspace lifecycle management and command execution.
 */

import { DaytonaConnectionError, DaytonaError } from './errors.js'

/**
 * Daytona API Client
 * Manages authentication and API communication
 */
export class DaytonaClient {
  constructor(config) {
    this.config = config
    this.baseUrl = config.baseUrl || 'https://api.daytona.io'
    this.apiKey = config.apiKey
    this.timeout = config.timeout || 60000
  }

  /**
   * Make authenticated HTTP request
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const config = {
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'TaskMaster-Flow/1.0',
        ...options.headers
      },
      ...options
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new DaytonaConnectionError({
          code: `HTTP_${response.status}`,
          message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          category: 'connection',
          details: { status: response.status, endpoint, errorData }
        })
      }

      return await response.json()
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new DaytonaConnectionError({
          code: 'REQUEST_TIMEOUT',
          message: `Request timeout after ${this.timeout}ms`,
          category: 'connection',
          details: { endpoint, timeout: this.timeout }
        })
      }

      if (error instanceof DaytonaError) {
        throw error
      }

      throw new DaytonaConnectionError({
        code: 'REQUEST_FAILED',
        message: `Request failed: ${error.message}`,
        category: 'connection',
        details: { endpoint, originalError: error }
      })
    }
  }

  /**
   * Get user profile and available profiles
   */
  async getProfile() {
    return this.makeRequest('/api/v1/profile')
  }

  /**
   * List available workspace profiles
   */
  async listProfiles() {
    return this.makeRequest('/api/v1/profiles')
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(config) {
    return this.makeRequest('/api/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify({
        name: config.name,
        profile: config.profile,
        repository: config.repository,
        branch: config.branch || 'main',
        env: config.env || {},
        region: config.region,
        metadata: config.metadata
      })
    })
  }

  /**
   * Get workspace status
   */
  async getWorkspaceStatus(workspaceId) {
    return this.makeRequest(`/api/v1/workspaces/${workspaceId}/status`)
  }

  /**
   * Update workspace environment variables
   */
  async updateWorkspaceEnvironment(workspaceId, env) {
    return this.makeRequest(`/api/v1/workspaces/${workspaceId}/env`, {
      method: 'PATCH',
      body: JSON.stringify({ env })
    })
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId) {
    return this.makeRequest(`/api/v1/workspaces/${workspaceId}`, {
      method: 'DELETE'
    })
  }

  /**
   * Execute command in workspace
   */
  async executeCommand(workspaceId, config) {
    return this.makeRequest(`/api/v1/workspaces/${workspaceId}/execute`, {
      method: 'POST',
      body: JSON.stringify({
        command: config.command,
        workingDirectory: config.workingDirectory || '/workspace',
        timeout: config.timeout || 60000,
        env: config.env || {}
      })
    })
  }

  /**
   * Get workspace logs
   */
  async getWorkspaceLogs(workspaceId, options = {}) {
    const params = new URLSearchParams()
    if (options.since) params.append('since', options.since)
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.follow) params.append('follow', 'true')

    const endpoint = `/api/v1/workspaces/${workspaceId}/logs${params.toString() ? `?${params}` : ''}`
    return this.makeRequest(endpoint)
  }

  /**
   * Stream workspace logs
   */
  async streamWorkspaceLogs(workspaceId, callback) {
    const url = `${this.baseUrl}/api/v1/workspaces/${workspaceId}/logs/stream`
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/event-stream'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to connect to log stream: ${response.statusText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let buffer = ''
      let isActive = true

      while (isActive) {
        const { value, done } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              callback(data)
            } catch (error) {
              callback({
                type: 'error',
                message: `Failed to parse log data: ${error.message}`,
                timestamp: new Date().toISOString()
              })
            }
          }
        }
      }

      // Return cleanup function
      return () => {
        isActive = false
        reader.cancel()
      }
    } catch (error) {
      throw new DaytonaConnectionError({
        code: 'STREAM_LOGS_FAILED',
        message: `Failed to stream logs: ${error.message}`,
        category: 'connection',
        details: { workspaceId, originalError: error }
      })
    }
  }

  /**
   * List all workspaces
   */
  async listWorkspaces() {
    return this.makeRequest('/api/v1/workspaces')
  }

  /**
   * Get workspace details
   */
  async getWorkspace(workspaceId) {
    return this.makeRequest(`/api/v1/workspaces/${workspaceId}`)
  }

  /**
   * Start workspace
   */
  async startWorkspace(workspaceId) {
    return this.makeRequest(`/api/v1/workspaces/${workspaceId}/start`, {
      method: 'POST'
    })
  }

  /**
   * Stop workspace
   */
  async stopWorkspace(workspaceId) {
    return this.makeRequest(`/api/v1/workspaces/${workspaceId}/stop`, {
      method: 'POST'
    })
  }

  /**
   * Restart workspace
   */
  async restartWorkspace(workspaceId) {
    return this.makeRequest(`/api/v1/workspaces/${workspaceId}/restart`, {
      method: 'POST'
    })
  }
}

/**
 * Daytona Workspace wrapper
 * Provides high-level workspace operations
 */
export class DaytonaWorkspace {
  constructor(client, workspaceData) {
    this.client = client
    this.id = workspaceData.id
    this.name = workspaceData.name
    this.profile = workspaceData.profile
    this.status = workspaceData.status
    this.metadata = workspaceData.metadata
  }

  /**
   * Execute command in this workspace
   */
  async execute(command, options = {}) {
    return this.client.executeCommand(this.id, {
      command,
      ...options
    })
  }

  /**
   * Get workspace status
   */
  async getStatus() {
    const status = await this.client.getWorkspaceStatus(this.id)
    this.status = status.status
    return status
  }

  /**
   * Check if workspace is running
   */
  async isRunning() {
    const status = await this.getStatus()
    return status.status === 'ready' || status.status === 'running'
  }

  /**
   * Start workspace
   */
  async start() {
    return this.client.startWorkspace(this.id)
  }

  /**
   * Stop workspace
   */
  async stop() {
    return this.client.stopWorkspace(this.id)
  }

  /**
   * Restart workspace
   */
  async restart() {
    return this.client.restartWorkspace(this.id)
  }

  /**
   * Delete workspace
   */
  async delete() {
    return this.client.deleteWorkspace(this.id)
  }

  /**
   * Get logs
   */
  async getLogs(options = {}) {
    return this.client.getWorkspaceLogs(this.id, options)
  }

  /**
   * Stream logs
   */
  async streamLogs(callback) {
    return this.client.streamWorkspaceLogs(this.id, callback)
  }
}

/**
 * Create Daytona client instance
 */
export async function createDaytonaClient(config) {
  const client = new DaytonaClient(config)
  
  // Test authentication
  try {
    await client.getProfile()
  } catch (error) {
    throw new DaytonaConnectionError({
      code: 'AUTHENTICATION_FAILED',
      message: 'Failed to authenticate with Daytona API',
      category: 'connection',
      details: { originalError: error }
    })
  }

  return client
} 