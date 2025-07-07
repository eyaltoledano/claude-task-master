/**
 * @fileoverview E2B Sandbox Provider Implementation
 *
 * Implements secure code execution using E2B's AI-focused sandbox platform.
 * Features container isolation, resource management, and API key authentication.
 */

import { createE2BClient } from './client.js';
import { E2BResourceManager } from './resource-manager.js';
import { E2BError, E2BConnectionError, E2BExecutionError } from './errors.js';

/**
 * E2B Provider Implementation
 * Provides secure Node.js code execution in isolated containers
 */
export class E2BProvider {
	constructor(config = {}) {
		this.config = {
			apiKey: config.apiKey || process.env.E2B_API_KEY,
			baseUrl: config.baseUrl || 'https://api.e2b.dev',
			defaultTemplate: config.defaultTemplate || 'node20',
			timeout: config.timeout || 30000,
			maxConcurrent: config.maxConcurrent || 5,
			enableTLS: config.enableTLS !== false,
			...config
		};

		this.client = null;
		this.resourceManager = new E2BResourceManager(this.config);
		this.activeResources = new Map();
		this.metrics = {
			created: 0,
			destroyed: 0,
			executed: 0,
			errors: 0,
			totalCost: 0
		};
	}

	/**
	 * Initialize the E2B provider
	 */
	async initialize() {
		try {
			if (!this.config.apiKey) {
				throw new E2BError({
					code: 'MISSING_API_KEY',
					message: 'E2B API key is required',
					category: 'configuration'
				});
			}

			this.client = await createE2BClient(this.config);
			await this.healthCheck();

			return {
				success: true,
				provider: 'e2b',
				initialized: true,
				capabilities: await this.getCapabilities()
			};
		} catch (error) {
			throw new E2BConnectionError({
				code: 'INITIALIZATION_FAILED',
				message: `Failed to initialize E2B provider: ${error.message}`,
				category: 'connection',
				details: { originalError: error }
			});
		}
	}

	/**
	 * Create a new sandbox resource
	 */
	async createResource(config = {}) {
		try {
			const resourceConfig = {
				template: config.template || this.config.defaultTemplate,
				timeout: config.timeout || this.config.timeout,
				env: config.environment || {},
				metadata: {
					createdAt: new Date().toISOString(),
					provider: 'e2b',
					...config.metadata
				},
				...config
			};

			const sandbox = await this.client.createSandbox({
				template: resourceConfig.template,
				apiKey: this.config.apiKey,
				timeoutMs: resourceConfig.timeout,
				metadata: resourceConfig.metadata
			});

			const resource = {
				id: sandbox.id,
				type: 'sandbox',
				provider: 'e2b',
				status: 'ready',
				template: resourceConfig.template,
				createdAt: new Date().toISOString(),
				config: resourceConfig,
				sandbox: sandbox,
				metadata: resourceConfig.metadata
			};

			this.activeResources.set(resource.id, resource);
			this.metrics.created++;

			await this.resourceManager.trackResource(resource);

			return {
				success: true,
				resource: {
					id: resource.id,
					type: resource.type,
					provider: resource.provider,
					status: resource.status,
					template: resource.template,
					createdAt: resource.createdAt,
					metadata: resource.metadata
				}
			};
		} catch (error) {
			this.metrics.errors++;
			throw new E2BError({
				code: 'RESOURCE_CREATION_FAILED',
				message: `Failed to create E2B sandbox: ${error.message}`,
				category: 'resource',
				details: { config, originalError: error }
			});
		}
	}

	/**
	 * Update resource configuration
	 */
	async updateResource(resourceId, updates = {}) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				throw new E2BError({
					code: 'RESOURCE_NOT_FOUND',
					message: `Resource ${resourceId} not found`,
					category: 'resource'
				});
			}

			// Update metadata and configuration
			if (updates.metadata) {
				resource.metadata = { ...resource.metadata, ...updates.metadata };
			}

			if (updates.environment) {
				// E2B doesn't support runtime environment updates, log warning
				console.warn('E2B does not support runtime environment updates');
			}

			this.activeResources.set(resourceId, resource);
			await this.resourceManager.updateResource(resourceId, updates);

			return {
				success: true,
				resource: {
					id: resource.id,
					status: resource.status,
					updatedAt: new Date().toISOString(),
					metadata: resource.metadata
				}
			};
		} catch (error) {
			this.metrics.errors++;
			throw new E2BError({
				code: 'RESOURCE_UPDATE_FAILED',
				message: `Failed to update resource ${resourceId}: ${error.message}`,
				category: 'resource',
				details: { resourceId, updates, originalError: error }
			});
		}
	}

	/**
	 * Delete/destroy a sandbox resource
	 */
	async deleteResource(resourceId) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				return { success: true, message: 'Resource already deleted' };
			}

			// Close the sandbox
			if (resource.sandbox && typeof resource.sandbox.close === 'function') {
				await resource.sandbox.close();
			}

			this.activeResources.delete(resourceId);
			this.metrics.destroyed++;

			await this.resourceManager.untrackResource(resourceId);

			return {
				success: true,
				resourceId,
				deletedAt: new Date().toISOString()
			};
		} catch (error) {
			this.metrics.errors++;
			throw new E2BError({
				code: 'RESOURCE_DELETION_FAILED',
				message: `Failed to delete resource ${resourceId}: ${error.message}`,
				category: 'resource',
				details: { resourceId, originalError: error }
			});
		}
	}

	/**
	 * Get resource status
	 */
	async getResourceStatus(resourceId) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				return {
					success: false,
					status: 'not_found',
					message: `Resource ${resourceId} not found`
				};
			}

			// Check if sandbox is still alive
			let isAlive = true;
			try {
				if (
					resource.sandbox &&
					typeof resource.sandbox.isRunning === 'function'
				) {
					isAlive = await resource.sandbox.isRunning();
				}
			} catch (error) {
				isAlive = false;
			}

			const status = isAlive ? 'ready' : 'terminated';
			resource.status = status;

			return {
				success: true,
				resource: {
					id: resource.id,
					type: resource.type,
					provider: resource.provider,
					status: status,
					template: resource.template,
					createdAt: resource.createdAt,
					lastChecked: new Date().toISOString(),
					metadata: resource.metadata
				}
			};
		} catch (error) {
			this.metrics.errors++;
			throw new E2BError({
				code: 'STATUS_CHECK_FAILED',
				message: `Failed to get status for resource ${resourceId}: ${error.message}`,
				category: 'resource',
				details: { resourceId, originalError: error }
			});
		}
	}

	/**
	 * List all resources
	 */
	async listResources() {
		try {
			const resources = Array.from(this.activeResources.values()).map(
				(resource) => ({
					id: resource.id,
					type: resource.type,
					provider: resource.provider,
					status: resource.status,
					template: resource.template,
					createdAt: resource.createdAt,
					metadata: resource.metadata
				})
			);

			return {
				success: true,
				resources,
				total: resources.length,
				provider: 'e2b'
			};
		} catch (error) {
			this.metrics.errors++;
			throw new E2BError({
				code: 'LIST_RESOURCES_FAILED',
				message: `Failed to list resources: ${error.message}`,
				category: 'resource',
				details: { originalError: error }
			});
		}
	}

	/**
	 * Execute code in a sandbox
	 */
	async executeAction(resourceId, action, parameters = {}) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				throw new E2BError({
					code: 'RESOURCE_NOT_FOUND',
					message: `Resource ${resourceId} not found`,
					category: 'resource'
				});
			}

			if (action !== 'execute') {
				throw new E2BError({
					code: 'UNSUPPORTED_ACTION',
					message: `Action '${action}' not supported by E2B provider`,
					category: 'execution'
				});
			}

			const { code, language = 'javascript', timeout = 30000 } = parameters;

			if (!code) {
				throw new E2BError({
					code: 'MISSING_CODE',
					message: 'Code parameter is required for execution',
					category: 'execution'
				});
			}

			const startTime = Date.now();
			let result;

			if (language === 'javascript' || language === 'node') {
				// Execute Node.js code
				result = await resource.sandbox.runCode(code, {
					language: 'javascript',
					timeoutMs: timeout
				});
			} else {
				// For other languages, use shell execution
				result = await resource.sandbox.commands.run(
					`echo '${code.replace(/'/g, "\\'")}' | ${this.getLanguageCommand(language)}`,
					{
						timeoutMs: timeout
					}
				);
			}

			const endTime = Date.now();
			this.metrics.executed++;

			return {
				success: true,
				execution: {
					resourceId,
					action,
					language,
					startTime: new Date(startTime).toISOString(),
					endTime: new Date(endTime).toISOString(),
					duration: endTime - startTime,
					stdout: result.stdout || '',
					stderr: result.stderr || '',
					exitCode: result.exitCode || 0,
					output: result.stdout || result.text || '',
					metadata: {
						provider: 'e2b',
						template: resource.template
					}
				}
			};
		} catch (error) {
			this.metrics.errors++;
			throw new E2BExecutionError({
				code: 'EXECUTION_FAILED',
				message: `Failed to execute code in resource ${resourceId}: ${error.message}`,
				category: 'execution',
				details: { resourceId, action, parameters, originalError: error }
			});
		}
	}

	/**
	 * Get execution logs
	 */
	async getResourceLogs(resourceId, options = {}) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				throw new E2BError({
					code: 'RESOURCE_NOT_FOUND',
					message: `Resource ${resourceId} not found`,
					category: 'resource'
				});
			}

			// E2B doesn't expose general logs API, return execution history from resource manager
			const logs = await this.resourceManager.getResourceLogs(
				resourceId,
				options
			);

			return {
				success: true,
				logs,
				resourceId,
				provider: 'e2b'
			};
		} catch (error) {
			this.metrics.errors++;
			throw new E2BError({
				code: 'GET_LOGS_FAILED',
				message: `Failed to get logs for resource ${resourceId}: ${error.message}`,
				category: 'resource',
				details: { resourceId, options, originalError: error }
			});
		}
	}

	/**
	 * Stream execution logs (mock implementation for E2B)
	 */
	async streamResourceLogs(resourceId, callback) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				throw new E2BError({
					code: 'RESOURCE_NOT_FOUND',
					message: `Resource ${resourceId} not found`,
					category: 'resource'
				});
			}

			// E2B doesn't support real-time log streaming, simulate with intervals
			const streamInterval = setInterval(async () => {
				try {
					const logs = await this.getResourceLogs(resourceId, { recent: true });
					if (logs.success && logs.logs.length > 0) {
						logs.logs.forEach((log) => callback(log));
					}
				} catch (error) {
					callback({
						type: 'error',
						message: error.message,
						timestamp: new Date().toISOString()
					});
				}
			}, 1000);

			// Return cleanup function
			return () => clearInterval(streamInterval);
		} catch (error) {
			this.metrics.errors++;
			throw new E2BError({
				code: 'STREAM_LOGS_FAILED',
				message: `Failed to stream logs for resource ${resourceId}: ${error.message}`,
				category: 'resource',
				details: { resourceId, originalError: error }
			});
		}
	}

	/**
	 * Get provider capabilities
	 */
	async getCapabilities() {
		return {
			provider: 'e2b',
			languages: ['javascript', 'typescript', 'python', 'bash'],
			features: {
				filesystem: true,
				networking: true,
				persistentStorage: false,
				realTimeStreaming: false,
				packageInstallation: true,
				multiLanguage: true
			},
			limits: {
				maxExecutionTime: 300000, // 5 minutes
				maxMemory: '2GB',
				maxCPU: 2,
				maxConcurrentSandboxes: this.config.maxConcurrent
			},
			security: {
				containerIsolation: true,
				networkIsolation: true,
				fileSystemIsolation: true,
				resourceLimits: true
			}
		};
	}

	/**
	 * Health check
	 */
	async healthCheck() {
		try {
			if (!this.client) {
				throw new Error('Client not initialized');
			}

			// Try to list templates as a health check
			const response = await this.client.listTemplates();

			return {
				success: true,
				provider: 'e2b',
				status: 'healthy',
				checkedAt: new Date().toISOString(),
				metrics: this.metrics,
				activeResources: this.activeResources.size,
				templatesAvailable: response?.length || 0
			};
		} catch (error) {
			this.metrics.errors++;
			return {
				success: false,
				provider: 'e2b',
				status: 'unhealthy',
				error: error.message,
				checkedAt: new Date().toISOString(),
				metrics: this.metrics
			};
		}
	}

	/**
	 * Get provider metrics
	 */
	getMetrics() {
		return {
			...this.metrics,
			activeResources: this.activeResources.size,
			provider: 'e2b'
		};
	}

	/**
	 * Clean up all resources
	 */
	async cleanup() {
		const cleanupPromises = Array.from(this.activeResources.keys()).map(
			(resourceId) =>
				this.deleteResource(resourceId).catch((error) =>
					console.warn(
						`Failed to cleanup resource ${resourceId}:`,
						error.message
					)
				)
		);

		await Promise.all(cleanupPromises);
		this.activeResources.clear();

		return {
			success: true,
			cleanedUp: cleanupPromises.length,
			provider: 'e2b'
		};
	}

	/**
	 * Get command for language execution
	 */
	getLanguageCommand(language) {
		const commands = {
			python: 'python3',
			bash: 'bash',
			sh: 'sh',
			node: 'node',
			javascript: 'node'
		};
		return commands[language] || 'bash';
	}
}

/**
 * Create E2B provider instance
 */
export function createE2BProvider(config) {
	return new E2BProvider(config);
}

/**
 * Provider factory for registry
 */
export const E2BProviderFactory = {
	create: (config) => createE2BProvider(config),
	capabilities: async () => {
		const provider = createE2BProvider();
		return provider.getCapabilities();
	},
	healthCheck: async (config) => {
		const provider = createE2BProvider(config);
		try {
			await provider.initialize();
			return await provider.healthCheck();
		} catch (error) {
			return {
				success: false,
				provider: 'e2b',
				status: 'unhealthy',
				error: error.message
			};
		}
	}
};
