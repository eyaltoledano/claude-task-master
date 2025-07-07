/**
 * @fileoverview E2B API Client
 * 
 * Handles communication with the E2B sandbox API, including authentication,
 * request management, and error handling.
 */

import { E2BConnectionError, E2BError } from './errors.js'

/**
 * E2B Client for sandbox management
 */
export class E2BClient {
  constructor(config) {
    this.config = config
    this.baseUrl = config.baseUrl || 'https://api.e2b.dev'
    this.apiKey = config.apiKey
    this.timeout = config.timeout || 30000
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'TaskMaster-Flow/1.0.0'
    }
  }

  /**
   * Make HTTP request to E2B API
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const requestOptions = {
      method: 'GET',
      headers: this.headers,
      timeout: this.timeout,
      ...options
    }

    if (requestOptions.body && typeof requestOptions.body === 'object') {
      requestOptions.body = JSON.stringify(requestOptions.body)
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new E2BError({
          code: `HTTP_${response.status}`,
          message: `E2B API request failed: ${response.status} ${response.statusText} - ${errorText}`,
          category: 'api',
          details: { 
            status: response.status, 
            statusText: response.statusText, 
            url, 
            method: requestOptions.method 
          }
        })
      }

      const data = await response.json().catch(() => null)
      return data
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new E2BConnectionError({
          code: 'TIMEOUT',
          message: `E2B API request timed out after ${this.timeout}ms`,
          category: 'connection',
          details: { timeout: this.timeout, url }
        })
      }

      if (error instanceof E2BError) {
        throw error
      }

      throw new E2BConnectionError({
        code: 'NETWORK_ERROR',
        message: `E2B API network error: ${error.message}`,
        category: 'connection',
        details: { originalError: error, url }
      })
    }
  }

  /**
   * List available templates
   */
  async listTemplates() {
    try {
      const response = await this.makeRequest('/templates')
      return response?.templates || []
    } catch (error) {
      throw new E2BError({
        code: 'LIST_TEMPLATES_FAILED',
        message: `Failed to list E2B templates: ${error.message}`,
        category: 'api',
        details: { originalError: error }
      })
    }
  }

  /**
   * Create a new sandbox
   */
  async createSandbox(config) {
    try {
      const requestBody = {
        template: config.template || 'node20',
        timeout: config.timeoutMs || 30000,
        metadata: config.metadata || {}
      }

      const response = await this.makeRequest('/sandboxes', {
        method: 'POST',
        body: requestBody
      })

      if (!response?.id) {
        throw new E2BError({
          code: 'INVALID_RESPONSE',
          message: 'E2B API returned invalid sandbox creation response',
          category: 'api',
          details: { response, requestBody }
        })
      }

      return new E2BSandbox(response.id, this, config)
    } catch (error) {
      throw new E2BError({
        code: 'CREATE_SANDBOX_FAILED',
        message: `Failed to create E2B sandbox: ${error.message}`,
        category: 'api',
        details: { config, originalError: error }
      })
    }
  }

  /**
   * Get sandbox status
   */
  async getSandboxStatus(sandboxId) {
    try {
      const response = await this.makeRequest(`/sandboxes/${sandboxId}`)
      return response
    } catch (error) {
      throw new E2BError({
        code: 'GET_SANDBOX_STATUS_FAILED',
        message: `Failed to get E2B sandbox status: ${error.message}`,
        category: 'api',
        details: { sandboxId, originalError: error }
      })
    }
  }

  /**
   * Delete a sandbox
   */
  async deleteSandbox(sandboxId) {
    try {
      await this.makeRequest(`/sandboxes/${sandboxId}`, {
        method: 'DELETE'
      })
      return { success: true, sandboxId }
    } catch (error) {
      throw new E2BError({
        code: 'DELETE_SANDBOX_FAILED',
        message: `Failed to delete E2B sandbox: ${error.message}`,
        category: 'api',
        details: { sandboxId, originalError: error }
      })
    }
  }

  /**
   * Execute code in sandbox
   */
  async executeCode(sandboxId, code, options = {}) {
    try {
      const requestBody = {
        code,
        language: options.language || 'javascript',
        timeout: options.timeoutMs || 30000
      }

      const response = await this.makeRequest(`/sandboxes/${sandboxId}/execute`, {
        method: 'POST',
        body: requestBody
      })

      return {
        stdout: response?.stdout || '',
        stderr: response?.stderr || '',
        exitCode: response?.exitCode || 0,
        output: response?.output || response?.stdout || '',
        executionTime: response?.executionTime || 0
      }
    } catch (error) {
      throw new E2BError({
        code: 'EXECUTE_CODE_FAILED',
        message: `Failed to execute code in E2B sandbox: ${error.message}`,
        category: 'execution',
        details: { sandboxId, code: code.substring(0, 100), originalError: error }
      })
    }
  }

  /**
   * Run shell command in sandbox
   */
  async runCommand(sandboxId, command, options = {}) {
    try {
      const requestBody = {
        command,
        timeout: options.timeoutMs || 30000,
        cwd: options.cwd || '/'
      }

      const response = await this.makeRequest(`/sandboxes/${sandboxId}/commands`, {
        method: 'POST',
        body: requestBody
      })

      return {
        stdout: response?.stdout || '',
        stderr: response?.stderr || '',
        exitCode: response?.exitCode || 0,
        output: response?.output || response?.stdout || ''
      }
    } catch (error) {
      throw new E2BError({
        code: 'RUN_COMMAND_FAILED',
        message: `Failed to run command in E2B sandbox: ${error.message}`,
        category: 'execution',
        details: { sandboxId, command, originalError: error }
      })
    }
  }
}

/**
 * E2B Sandbox wrapper
 */
export class E2BSandbox {
  constructor(id, client, config) {
    this.id = id
    this.client = client
    this.config = config
    this.isActive = true
  }

  /**
   * Run code in this sandbox
   */
  async runCode(code, options = {}) {
    if (!this.isActive) {
      throw new E2BError({
        code: 'SANDBOX_INACTIVE',
        message: 'Cannot execute code in inactive sandbox',
        category: 'execution'
      })
    }

    return await this.client.executeCode(this.id, code, options)
  }

  /**
   * Run shell command in this sandbox
   */
  get commands() {
    const sandbox = this
    return {
      run: async (command, options = {}) => {
        if (!sandbox.isActive) {
          throw new E2BError({
            code: 'SANDBOX_INACTIVE',
            message: 'Cannot execute commands in inactive sandbox',
            category: 'execution'
          })
        }
        return await sandbox.client.runCommand(sandbox.id, command, options)
      }
    }
  }

  /**
   * Check if sandbox is running
   */
  async isRunning() {
    try {
      const status = await this.client.getSandboxStatus(this.id)
      return status?.status === 'running' || status?.status === 'ready'
    } catch (error) {
      return false
    }
  }

  /**
   * Close/destroy this sandbox
   */
  async close() {
    try {
      await this.client.deleteSandbox(this.id)
      this.isActive = false
      return { success: true }
    } catch (error) {
      this.isActive = false
      throw error
    }
  }

  /**
   * Get sandbox status
   */
  async getStatus() {
    return await this.client.getSandboxStatus(this.id)
  }
}

/**
 * Create E2B client instance
 */
export async function createE2BClient(config) {
  if (!config.apiKey) {
    throw new E2BConnectionError({
      code: 'MISSING_API_KEY',
      message: 'E2B API key is required',
      category: 'configuration'
    })
  }

  const client = new E2BClient(config)
  
  // Test connection by listing templates
  try {
    await client.listTemplates()
  } catch (error) {
    throw new E2BConnectionError({
      code: 'CONNECTION_TEST_FAILED',
      message: `Failed to connect to E2B API: ${error.message}`,
      category: 'connection',
      details: { originalError: error }
    })
  }

  return client
} 