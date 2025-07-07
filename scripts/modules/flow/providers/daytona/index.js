/**
 * @fileoverview Daytona Provider Implementation
 *
 * Implements secure code execution using Daytona's cloud-based development environments.
 * Features full Linux environments, persistent storage, and project-based isolation.
 * Based on VibeKit patterns and Task Master Phase 7 architecture.
 */

import { createDaytonaClient } from './client.js';
import { DaytonaResourceManager } from './resource-manager.js';
import {
	DaytonaError,
	DaytonaConnectionError,
	DaytonaExecutionError
} from './errors.js';

/**
 * Daytona Provider Implementation
 * Provides secure code execution in cloud-based development environments
 */
export class DaytonaProvider {
	constructor(config = {}) {
		this.config = {
			apiKey: config.apiKey || process.env.DAYTONA_API_KEY,
			baseUrl: config.baseUrl || 'https://api.daytona.io',
			defaultProfile: config.defaultProfile || 'default',
			timeout: config.timeout || 60000,
			maxConcurrent: config.maxConcurrent || 3,
			enableTLS: config.enableTLS !== false,
			region: config.region || 'us-east-1',
			...config
		};

		this.client = null;
		this.resourceManager = new DaytonaResourceManager(this.config);
		this.activeResources = new Map();
		this.metrics = {
			created: 0,
			destroyed: 0,
			executed: 0,
			errors: 0,
			totalCost: 0,
			totalUptime: 0
		};
	}

	/**
	 * Initialize the Daytona provider
	 */
	async initialize() {
		try {
			if (!this.config.apiKey) {
				throw new DaytonaError({
					code: 'MISSING_API_KEY',
					message: 'Daytona API key is required',
					category: 'configuration'
				});
			}

			this.client = await createDaytonaClient(this.config);
			await this.healthCheck();

			return {
				success: true,
				provider: 'daytona',
				initialized: true,
				capabilities: await this.getCapabilities()
			};
		} catch (error) {
			throw new DaytonaConnectionError({
				code: 'INITIALIZATION_FAILED',
				message: `Failed to initialize Daytona provider: ${error.message}`,
				category: 'connection',
				details: { originalError: error }
			});
		}
	}

	/**
	 * Create a new workspace resource
	 */
	async createResource(config = {}) {
		try {
			const resourceConfig = {
				name: config.name || `workspace-${Date.now()}`,
				profile: config.profile || this.config.defaultProfile,
				repository: config.repository || null,
				branch: config.branch || 'main',
				env: config.environment || {},
				region: config.region || this.config.region,
				metadata: {
					createdAt: new Date().toISOString(),
					provider: 'daytona',
					...config.metadata
				},
				...config
			};

			const workspace = await this.client.createWorkspace({
				name: resourceConfig.name,
				profile: resourceConfig.profile,
				repository: resourceConfig.repository,
				branch: resourceConfig.branch,
				env: resourceConfig.env,
				region: resourceConfig.region,
				metadata: resourceConfig.metadata
			});

			const resource = {
				id: workspace.id,
				type: 'workspace',
				provider: 'daytona',
				status: 'creating',
				profile: resourceConfig.profile,
				name: resourceConfig.name,
				createdAt: new Date().toISOString(),
				config: resourceConfig,
				workspace: workspace,
				metadata: resourceConfig.metadata
			};

			this.activeResources.set(resource.id, resource);
			this.metrics.created++;

			// Wait for workspace to be ready
			await this.waitForWorkspaceReady(resource.id);
			resource.status = 'ready';

			await this.resourceManager.trackResource(resource);

			return {
				success: true,
				resource: {
					id: resource.id,
					type: resource.type,
					provider: resource.provider,
					status: resource.status,
					profile: resource.profile,
					name: resource.name,
					createdAt: resource.createdAt,
					metadata: resource.metadata
				}
			};
		} catch (error) {
			this.metrics.errors++;
			throw new DaytonaError({
				code: 'RESOURCE_CREATION_FAILED',
				message: `Failed to create Daytona workspace: ${error.message}`,
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
				throw new DaytonaError({
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
				// Update environment variables in the workspace
				await this.client.updateWorkspaceEnvironment(
					resourceId,
					updates.environment
				);
				resource.config.env = {
					...resource.config.env,
					...updates.environment
				};
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
			throw new DaytonaError({
				code: 'RESOURCE_UPDATE_FAILED',
				message: `Failed to update resource ${resourceId}: ${error.message}`,
				category: 'resource',
				details: { resourceId, updates, originalError: error }
			});
		}
	}

	/**
	 * Delete/destroy a workspace resource
	 */
	async deleteResource(resourceId) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				return { success: true, message: 'Resource already deleted' };
			}

			// Stop and delete the workspace
			await this.client.deleteWorkspace(resourceId);

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
			throw new DaytonaError({
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

			// Check workspace status
			const workspaceStatus = await this.client.getWorkspaceStatus(resourceId);
			resource.status = workspaceStatus.status;

			return {
				success: true,
				resource: {
					id: resource.id,
					type: resource.type,
					provider: resource.provider,
					status: resource.status,
					profile: resource.profile,
					name: resource.name,
					createdAt: resource.createdAt,
					lastChecked: new Date().toISOString(),
					metadata: resource.metadata
				}
			};
		} catch (error) {
			this.metrics.errors++;
			throw new DaytonaError({
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
					profile: resource.profile,
					name: resource.name,
					createdAt: resource.createdAt,
					metadata: resource.metadata
				})
			);

			return {
				success: true,
				resources,
				total: resources.length,
				provider: 'daytona'
			};
		} catch (error) {
			this.metrics.errors++;
			throw new DaytonaError({
				code: 'LIST_RESOURCES_FAILED',
				message: `Failed to list resources: ${error.message}`,
				category: 'resource',
				details: { originalError: error }
			});
		}
	}

	/**
	 * Execute code in a workspace
	 */
	async executeAction(resourceId, action, parameters = {}) {
		try {
			const resource = this.activeResources.get(resourceId);
			if (!resource) {
				throw new DaytonaError({
					code: 'RESOURCE_NOT_FOUND',
					message: `Resource ${resourceId} not found`,
					category: 'resource'
				});
			}

			if (action !== 'execute') {
				throw new DaytonaError({
					code: 'UNSUPPORTED_ACTION',
					message: `Action '${action}' not supported by Daytona provider`,
					category: 'execution'
				});
			}

			const {
				code,
				language = 'bash',
				timeout = 60000,
				workingDir = '/workspace'
			} = parameters;

			if (!code) {
				throw new DaytonaError({
					code: 'MISSING_CODE',
					message: 'Code parameter is required for execution',
					category: 'execution'
				});
			}

			const startTime = Date.now();

			// Execute code in the workspace
			const result = await this.client.executeCommand(resourceId, {
				command: this.buildCommand(code, language),
				workingDirectory: workingDir,
				timeout: timeout,
				env: resource.config.env
			});

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
					output: result.stdout || result.output || '',
					metadata: {
						provider: 'daytona',
						profile: resource.profile,
						workingDir: workingDir
					}
				}
			};
		} catch (error) {
			this.metrics.errors++;
			throw new DaytonaExecutionError({
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
				throw new DaytonaError({
					code: 'RESOURCE_NOT_FOUND',
					message: `Resource ${resourceId} not found`,
					category: 'resource'
				});
			}

			const logs = await this.client.getWorkspaceLogs(resourceId, options);

			return {
				success: true,
				logs,
				resourceId,
				provider: 'daytona'
			};
		} catch (error) {
			this.metrics.errors++;
			throw new DaytonaError({
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
				throw new DaytonaError({
					code: 'RESOURCE_NOT_FOUND',
					message: `Resource ${resourceId} not found`,
					category: 'resource'
				});
			}

			return await this.client.streamWorkspaceLogs(resourceId, callback);
		} catch (error) {
			this.metrics.errors++;
			throw new DaytonaError({
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
			provider: 'daytona',
			languages: [
				'javascript',
				'typescript',
				'python',
				'go',
				'rust',
				'java',
				'bash'
			],
			features: {
				filesystem: true,
				networking: true,
				persistentStorage: true,
				realTimeStreaming: true,
				packageInstallation: true,
				multiLanguage: true,
				gitIntegration: true,
				vscodeIntegration: true
			},
			limits: {
				maxExecutionTime: 3600000, // 1 hour
				maxMemory: '8GB',
				maxCPU: 4,
				maxStorage: '100GB',
				maxConcurrentWorkspaces: this.config.maxConcurrent
			},
			security: {
				containerIsolation: true,
				networkIsolation: true,
				fileSystemIsolation: true,
				resourceLimits: true,
				sshAccess: true
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
				provider: 'daytona',
				status: 'healthy',
				checkedAt: new Date().toISOString(),
				metrics: this.metrics,
				activeResources: this.activeResources.size,
				profilesAvailable: response?.profiles?.length || 0
			};
		} catch (error) {
			this.metrics.errors++;
			return {
				success: false,
				provider: 'daytona',
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
			provider: 'daytona'
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
			provider: 'daytona'
		};
	}

	// Helper methods

	/**
	 * Wait for workspace to be ready
	 */
	async waitForWorkspaceReady(resourceId, maxAttempts = 30) {
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				const status = await this.client.getWorkspaceStatus(resourceId);
				if (status.status === 'ready') {
					return true;
				}
				if (status.status === 'failed') {
					throw new Error(`Workspace creation failed: ${status.error}`);
				}
				await new Promise((resolve) => setTimeout(resolve, 2000));
			} catch (error) {
				if (attempt === maxAttempts - 1) {
					throw error;
				}
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		}
		throw new Error('Workspace creation timeout');
	}

	/**
	 * Build command for language execution
	 */
	buildCommand(code, language) {
		const commands = {
			javascript: `echo '${code.replace(/'/g, "\\'")}' > /tmp/script.js && node /tmp/script.js`,
			typescript: `echo '${code.replace(/'/g, "\\'")}' > /tmp/script.ts && npx ts-node /tmp/script.ts`,
			python: `echo '${code.replace(/'/g, "\\'")}' > /tmp/script.py && python3 /tmp/script.py`,
			go: `echo '${code.replace(/'/g, "\\'")}' > /tmp/script.go && go run /tmp/script.go`,
			rust: `echo '${code.replace(/'/g, "\\'")}' > /tmp/script.rs && rustc /tmp/script.rs && ./script`,
			java: `echo '${code.replace(/'/g, "\\'")}' > /tmp/Script.java && javac /tmp/Script.java && java -cp /tmp Script`,
			bash: code
		};
		return commands[language] || `echo '${code.replace(/'/g, "\\'")}' | bash`;
	}
}

/**
 * Create Daytona provider instance
 */
export function createDaytonaProvider(config) {
	return new DaytonaProvider(config);
}

/**
 * Provider factory for registry
 */
export const DaytonaProviderFactory = {
	create: (config) => createDaytonaProvider(config),
	capabilities: async () => {
		const provider = createDaytonaProvider();
		return provider.getCapabilities();
	},
	healthCheck: async (config) => {
		const provider = createDaytonaProvider(config);
		try {
			await provider.initialize();
			return await provider.healthCheck();
		} catch (error) {
			return {
				success: false,
				provider: 'daytona',
				status: 'unhealthy',
				error: error.message
			};
		}
	}
};
