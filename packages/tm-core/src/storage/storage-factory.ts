/**
 * @fileoverview Storage factory for creating appropriate storage implementations
 */

import type { IStorage } from '../interfaces/storage.interface.js';
import type { IConfiguration } from '../interfaces/configuration.interface.js';
import { FileStorage } from './file-storage';
import { ApiStorage } from './api-storage.js';
import { ERROR_CODES, TaskMasterError } from '../errors/task-master-error.js';
import { AuthManager } from '../auth/auth-manager.js';
import { getLogger } from '../logger/index.js';

/**
 * Factory for creating storage implementations based on configuration
 */
export class StorageFactory {
	/**
	 * Create a storage implementation based on configuration
	 * @param config - Configuration object
	 * @param projectPath - Project root path (for file storage)
	 * @returns Storage implementation
	 */
	static create(
		config: Partial<IConfiguration>,
		projectPath: string
	): IStorage {
		const storageType = config.storage?.type || 'auto';

		const logger = getLogger('StorageFactory');

		switch (storageType) {
			case 'file':
				logger.debug('📁 Using local file storage');
				return StorageFactory.createFileStorage(projectPath, config);

			case 'api':
				if (!StorageFactory.isHamsterAvailable(config)) {
					// Check if authenticated via AuthManager
					const authManager = AuthManager.getInstance();
					if (!authManager.isAuthenticated()) {
						throw new TaskMasterError(
							'API storage configured but not authenticated. Run: tm auth login',
							ERROR_CODES.MISSING_CONFIGURATION,
							{ storageType: 'api' }
						);
					}
					// Use auth token from AuthManager
					const credentials = authManager.getCredentials();
					if (credentials) {
						// Merge with existing storage config, ensuring required fields
						config.storage = {
							...config.storage,
							type: 'api' as const,
							apiAccessToken: credentials.token,
							apiEndpoint:
								config.storage?.apiEndpoint ||
								process.env.HAMSTER_API_URL ||
								'https://tryhamster.com/api'
						} as any; // Cast to any to bypass strict type checking for partial config
					}
				}
				logger.info('☁️  Using API storage');
				return StorageFactory.createApiStorage(config);

			case 'auto':
				// Auto-detect based on authentication status
				const authManager = AuthManager.getInstance();

				// First check if API credentials are explicitly configured
				if (StorageFactory.isHamsterAvailable(config)) {
					logger.info('☁️  Using API storage (configured)');
					return StorageFactory.createApiStorage(config);
				}

				// Then check if authenticated via AuthManager
				if (authManager.isAuthenticated()) {
					const credentials = authManager.getCredentials();
					if (credentials) {
						// Configure API storage with auth credentials
						config.storage = {
							...config.storage,
							type: 'api' as const,
							apiAccessToken: credentials.token,
							apiEndpoint:
								config.storage?.apiEndpoint ||
								process.env.HAMSTER_API_URL ||
								'https://tryhamster.com/api'
						} as any; // Cast to any to bypass strict type checking for partial config
						logger.info('☁️  Using API storage (authenticated)');
						return StorageFactory.createApiStorage(config);
					}
				}

				// Default to file storage
				logger.debug('📁 Using local file storage');
				return StorageFactory.createFileStorage(projectPath, config);

			default:
				throw new TaskMasterError(
					`Unknown storage type: ${storageType}`,
					ERROR_CODES.INVALID_INPUT,
					{ storageType }
				);
		}
	}

	/**
	 * Create file storage implementation
	 */
	private static createFileStorage(
		projectPath: string,
		config: Partial<IConfiguration>
	): FileStorage {
		const basePath = config.storage?.basePath || projectPath;
		return new FileStorage(basePath);
	}

	/**
	 * Create API storage implementation
	 */
	private static createApiStorage(config: Partial<IConfiguration>): ApiStorage {
		const { apiEndpoint, apiAccessToken } = config.storage || {};

		if (!apiEndpoint) {
			throw new TaskMasterError(
				'API endpoint is required for API storage',
				ERROR_CODES.MISSING_CONFIGURATION,
				{ storageType: 'api' }
			);
		}

		if (!apiAccessToken) {
			throw new TaskMasterError(
				'API access token is required for API storage',
				ERROR_CODES.MISSING_CONFIGURATION,
				{ storageType: 'api' }
			);
		}

		return new ApiStorage({
			endpoint: apiEndpoint,
			accessToken: apiAccessToken,
			projectId: config.projectPath,
			timeout: config.retry?.requestTimeout,
			enableRetry: config.retry?.retryOnNetworkError,
			maxRetries: config.retry?.retryAttempts
		});
	}

	/**
	 * Detect optimal storage type based on available configuration
	 */
	static detectOptimalStorage(config: Partial<IConfiguration>): 'file' | 'api' {
		// If API credentials are provided, prefer API storage (Hamster)
		if (config.storage?.apiEndpoint && config.storage?.apiAccessToken) {
			return 'api';
		}

		// Default to file storage
		return 'file';
	}

	/**
	 * Validate storage configuration
	 */
	static validateStorageConfig(config: Partial<IConfiguration>): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];
		const storageType = config.storage?.type;

		if (!storageType) {
			errors.push('Storage type is not specified');
			return { isValid: false, errors };
		}

		switch (storageType) {
			case 'api':
				if (!config.storage?.apiEndpoint) {
					errors.push('API endpoint is required for API storage');
				}
				if (!config.storage?.apiAccessToken) {
					errors.push('API access token is required for API storage');
				}
				break;

			case 'file':
				// File storage doesn't require additional config
				break;

			default:
				errors.push(`Unknown storage type: ${storageType}`);
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	/**
	 * Check if Hamster (API storage) is available
	 */
	static isHamsterAvailable(config: Partial<IConfiguration>): boolean {
		return !!(config.storage?.apiEndpoint && config.storage?.apiAccessToken);
	}

	/**
	 * Create a storage implementation with fallback
	 * Tries API storage first, falls back to file storage
	 */
	static async createWithFallback(
		config: Partial<IConfiguration>,
		projectPath: string
	): Promise<IStorage> {
		// Try API storage if configured
		if (StorageFactory.isHamsterAvailable(config)) {
			try {
				const apiStorage = StorageFactory.createApiStorage(config);
				await apiStorage.initialize();
				return apiStorage;
			} catch (error) {
				const logger = getLogger('StorageFactory');
				logger.warn(
					'Failed to initialize API storage, falling back to file storage:',
					error
				);
			}
		}

		// Fallback to file storage
		return StorageFactory.createFileStorage(projectPath, config);
	}
}
