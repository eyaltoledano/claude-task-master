/**
 * @fileoverview Storage factory for creating appropriate storage implementations
 */

import type { IStorage } from '../interfaces/storage.interface.js';
import type {
	IConfiguration,
	RuntimeStorageConfig,
	StorageSettings
} from '../interfaces/configuration.interface.js';
import { FileStorage } from './file-storage/index.js';
import { ApiStorage } from './api-storage.js';
import { ERROR_CODES, TaskMasterError } from '../errors/task-master-error.js';
import { AuthManager } from '../auth/auth-manager.js';
import { getLogger } from '../logger/index.js';

/**
 * Factory for creating storage implementations based on configuration
 */
export class StorageFactory {
	/**
	 * Create a storage implementation from runtime storage config
	 * This is the preferred method when you have a RuntimeStorageConfig
	 * @param storageConfig - Runtime storage configuration
	 * @param projectPath - Project root path (for file storage)
	 * @returns Storage implementation
	 */
	static createFromStorageConfig(
		storageConfig: RuntimeStorageConfig,
		projectPath: string
	): IStorage {
		// Wrap the storage config in the expected format, including projectPath
		// This ensures ApiStorage receives the projectPath for projectId
		return StorageFactory.create(
			{ storage: storageConfig, projectPath } as Partial<IConfiguration>,
			projectPath
		);
	}

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
					const missing: string[] = [];
					if (!config.storage?.apiEndpoint) missing.push('apiEndpoint');
					if (!config.storage?.apiAccessToken) missing.push('apiAccessToken');

					// Check if authenticated via AuthManager
					const authManager = AuthManager.getInstance();
					if (!authManager.isAuthenticated()) {
						throw new TaskMasterError(
							`API storage not fully configured (${missing.join(', ') || 'credentials missing'}). Run: tm auth login, or set the missing field(s).`,
							ERROR_CODES.MISSING_CONFIGURATION,
							{ storageType: 'api', missing }
						);
					}
					// Use auth token from AuthManager
					const credentials = authManager.getCredentials();
					if (credentials) {
						// Merge with existing storage config, ensuring required fields
						const nextStorage: StorageSettings = {
							...(config.storage as StorageSettings),
							type: 'api',
							apiAccessToken: credentials.token,
							apiEndpoint:
								config.storage?.apiEndpoint ||
								process.env.HAMSTER_API_URL ||
								'https://tryhamster.com/api'
						};
						config.storage = nextStorage;
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
						const nextStorage: StorageSettings = {
							...(config.storage as StorageSettings),
							type: 'api',
							apiAccessToken: credentials.token,
							apiEndpoint:
								config.storage?.apiEndpoint ||
								process.env.HAMSTER_API_URL ||
								'https://tryhamster.com/api'
						};
						config.storage = nextStorage;
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

			case 'auto':
				// Auto storage is valid - it will determine the actual type at runtime
				// No specific validation needed as it will fall back to file if API not configured
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
