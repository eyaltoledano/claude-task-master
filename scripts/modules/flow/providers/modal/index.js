/**
 * @fileoverview Modal Provider Implementation
 *
 * Implements secure code execution using Modal's serverless compute platform.
 * Features GPU support, auto-scaling, and serverless function execution.
 * Based on VibeKit patterns and Task Master Phase 7 architecture.
 */

import { createModalClient } from './client.js';
import { ModalResourceManager } from './resource-manager.js';
import {
	ModalError,
	ModalConnectionError,
	ModalExecutionError
} from './errors.js';

/**
 * Modal Provider Implementation
 * Provides serverless code execution with GPU support and auto-scaling
 */
export class ModalProvider {
	constructor(config = {}) {
		this.config = {
			apiKey: config.apiKey || process.env.MODAL_API_KEY,
			baseUrl: config.baseUrl || 'https://api.modal.com',
			defaultImage: config.defaultImage || 'python:3.11',
			timeout: config.timeout || 300000, // 5 minutes default
			maxConcurrent: config.maxConcurrent || 10,
			enableGPU: config.enableGPU || false,
			...config
		};

		this.client = null;
		this.resourceManager = new ModalResourceManager(this.config);
		this.activeResources = new Map();
		this.metrics = {
			created: 0,
			destroyed: 0,
			executed: 0,
			errors: 0,
			totalCost: 0,
			gpuHours: 0,
			cpuHours: 0
		};
	}

	/**
	 * Initialize the Modal provider
	 */
	async initialize() {
		try {
			if (!this.config.apiKey) {
				throw new ModalError({
					code: 'MISSING_API_KEY',
					message: 'Modal API key is required',
					category: 'configuration'
				});
			}

			this.client = await createModalClient(this.config);
			await this.healthCheck();

			return {
				success: true,
				provider: 'modal',
				initialized: true,
				capabilities: await this.getCapabilities()
			};
		} catch (error) {
			throw new ModalConnectionError({
				code: 'INITIALIZATION_FAILED',
				message: `Failed to initialize Modal provider: ${error.message}`,
				category: 'connection',
				details: { originalError: error }
			});
		}
	}

	/**
	 * Create a new function resource
	 */
	async createResource(config = {}) {
		try {
			const resourceConfig = {
				name: config.name || `function-${Date.now()}`,
				image: config.image || this.config.defaultImage,
				cpu: config.cpu || 1,
				memory: config.memory || '2GB',
				gpu: config.gpu || (this.config.enableGPU ? 'T4' : null),
				timeout: config.timeout || this.config.timeout,
				env: config.environment || {},
				secrets: config.secrets || [],
				metadata: {
					createdAt: new Date().toISOString(),
					provider: 'modal',
					...config.metadata
				},
				...config
			};

			const modalFunction = await this.client.createFunction({
				name: resourceConfig.name,
				image: resourceConfig.image,
				cpu: resourceConfig.cpu,
				memory: resourceConfig.memory,
				gpu: resourceConfig.gpu,
				timeout: resourceConfig.timeout,
				env: resourceConfig.env,
				secrets: resourceConfig.secrets,
				metadata: resourceConfig.metadata
			});

			const resource = {
				id: modalFunction.id,
				type: 'function',
				provider: 'modal',
				status: 'ready',
				name: resourceConfig.name,
				image: resourceConfig.image,
				createdAt: new Date().toISOString(),
				config: resourceConfig,
				modalFunction: modalFunction,
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
					name: resource.name,
					image: resource.image,
					createdAt: resource.createdAt,
					metadata: resource.metadata
				}
			};
		} catch (error) {
			this.metrics.errors++;
			throw new ModalError({
				code: 'RESOURCE_CREATION_FAILED',
				message: `Failed to create Modal function: ${error.message}`,
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
				throw new ModalError({
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
				// Modal functions are immutable, log warning
				console.warn(
					'Modal functions are immutable. Environment updates require recreation.'
				);
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
			throw new ModalError({
				code: 'RESOURCE_UPDATE_FAILED',
				message: `Failed to update resource ${resourceId}: ${error.message}`,
				category: 'resource',
				details: { resourceId, updates, originalError: error }
			});
		}
	}

	/**
	 * Delete/destroy a function resource
	 */
	async deleteResource(resourceId) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				return { success: true, message: 'Resource already deleted' };
			}

			// Delete the Modal function
			await this.client.deleteFunction(resourceId);

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
			throw new ModalError({
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

			// Check function status
			const functionStatus = await this.client.getFunctionStatus(resourceId);
			resource.status = functionStatus.status;

			return {
				success: true,
				resource: {
					id: resource.id,
					type: resource.type,
					provider: resource.provider,
					status: resource.status,
					name: resource.name,
					image: resource.image,
					createdAt: resource.createdAt,
					lastChecked: new Date().toISOString(),
					metadata: resource.metadata
				}
			};
		} catch (error) {
			this.metrics.errors++;
			throw new ModalError({
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
					name: resource.name,
					image: resource.image,
					createdAt: resource.createdAt,
					metadata: resource.metadata
				})
			);

			return {
				success: true,
				resources,
				total: resources.length,
				provider: 'modal'
			};
		} catch (error) {
			this.metrics.errors++;
			throw new ModalError({
				code: 'LIST_RESOURCES_FAILED',
				message: `Failed to list resources: ${error.message}`,
				category: 'resource',
				details: { originalError: error }
			});
		}
	}

	/**
	 * Execute code in a Modal function
	 */
	async executeAction(resourceId, action, parameters = {}) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				throw new ModalError({
					code: 'RESOURCE_NOT_FOUND',
					message: `Resource ${resourceId} not found`,
					category: 'resource'
				});
			}

			if (action !== 'execute') {
				throw new ModalError({
					code: 'UNSUPPORTED_ACTION',
					message: `Action '${action}' not supported by Modal provider`,
					category: 'execution'
				});
			}

			const {
				code,
				language = 'python',
				timeout = 300000,
				args = []
			} = parameters;

			if (!code) {
				throw new ModalError({
					code: 'MISSING_CODE',
					message: 'Code parameter is required for execution',
					category: 'execution'
				});
			}

			const startTime = Date.now();

			// Execute code via Modal function
			const result = await this.client.invokeFunction(resourceId, {
				code: code,
				language: language,
				timeout: timeout,
				args: args,
				env: resource.config.env
			});

			const endTime = Date.now();
			this.metrics.executed++;

			// Track GPU/CPU usage
			if (resource.config.gpu) {
				this.metrics.gpuHours += (endTime - startTime) / (1000 * 60 * 60);
			} else {
				this.metrics.cpuHours += (endTime - startTime) / (1000 * 60 * 60);
			}

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
					output: result.output || result.stdout || '',
					metadata: {
						provider: 'modal',
						image: resource.image,
						gpu: resource.config.gpu || 'none',
						cpu: resource.config.cpu,
						memory: resource.config.memory
					}
				}
			};
		} catch (error) {
			this.metrics.errors++;
			throw new ModalExecutionError({
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
				throw new ModalError({
					code: 'RESOURCE_NOT_FOUND',
					message: `Resource ${resourceId} not found`,
					category: 'resource'
				});
			}

			const logs = await this.client.getFunctionLogs(resourceId, options);

			return {
				success: true,
				logs,
				resourceId,
				provider: 'modal'
			};
		} catch (error) {
			this.metrics.errors++;
			throw new ModalError({
				code: 'GET_LOGS_FAILED',
				message: `Failed to get logs for resource ${resourceId}: ${error.message}`,
				category: 'resource',
				details: { resourceId, options, originalError: error }
			});
		}
	}

	/**
	 * Stream execution logs
	 */
	async streamResourceLogs(resourceId, callback) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				throw new ModalError({
					code: 'RESOURCE_NOT_FOUND',
					message: `Resource ${resourceId} not found`,
					category: 'resource'
				});
			}

			return await this.client.streamFunctionLogs(resourceId, callback);
		} catch (error) {
			this.metrics.errors++;
			throw new ModalError({
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
			provider: 'modal',
			languages: ['python', 'javascript', 'typescript', 'bash'],
			features: {
				filesystem: true,
				networking: true,
				persistentStorage: true,
				realTimeStreaming: true,
				packageInstallation: true,
				multiLanguage: true,
				gpuSupport: true,
				autoScaling: true,
				serverless: true
			},
			limits: {
				maxExecutionTime: 3600000, // 1 hour
				maxMemory: '64GB',
				maxCPU: 16,
				maxGPU: 8,
				maxConcurrentFunctions: this.config.maxConcurrent
			},
			security: {
				containerIsolation: true,
				networkIsolation: true,
				fileSystemIsolation: true,
				resourceLimits: true,
				secretsManagement: true
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

			const response = await this.client.getProfile();

			return {
				success: true,
				provider: 'modal',
				status: 'healthy',
				checkedAt: new Date().toISOString(),
				metrics: this.metrics,
				activeResources: this.activeResources.size,
				creditsRemaining: response?.credits || 0
			};
		} catch (error) {
			this.metrics.errors++;
			return {
				success: false,
				provider: 'modal',
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
			provider: 'modal'
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
			provider: 'modal'
		};
	}

	// Helper methods

	/**
	 * Get language runtime for Modal execution
	 */
	getLanguageRuntime(language) {
		const runtimes = {
			python: 'python:3.11',
			javascript: 'node:18',
			typescript: 'node:18',
			bash: 'ubuntu:22.04'
		};
		return runtimes[language] || runtimes['python'];
	}
}

/**
 * Create Modal provider instance
 */
export function createModalProvider(config) {
	return new ModalProvider(config);
}

/**
 * Provider factory for registry
 */
export const ModalProviderFactory = {
	create: (config) => createModalProvider(config),
	capabilities: async () => {
		const provider = createModalProvider();
		return provider.getCapabilities();
	},
	healthCheck: async (config) => {
		const provider = createModalProvider(config);
		try {
			await provider.initialize();
			return await provider.healthCheck();
		} catch (error) {
			return {
				success: false,
				provider: 'modal',
				status: 'unhealthy',
				error: error.message
			};
		}
	}
};
