/**
 * @fileoverview Storage factory for creating appropriate storage implementations
 */

import type { IStorage } from '../interfaces/storage.interface.js';
import type { IConfiguration } from '../interfaces/configuration.interface.js';
import { FileStorage } from './file-storage';
import { ApiStorage } from './api-storage.js';
import { ERROR_CODES, TaskMasterError } from '../errors/task-master-error.js';

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
		const storageType = config.storage?.type || 'file';

		switch (storageType) {
			case 'file':
				return StorageFactory.createFileStorage(projectPath, config);

			case 'api':
				return StorageFactory.createApiStorage(config);

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
				console.warn(
					'Failed to initialize API storage, falling back to file storage:',
					error
				);
			}
		}

		// Fallback to file storage
		return StorageFactory.createFileStorage(projectPath, config);
	}
}
