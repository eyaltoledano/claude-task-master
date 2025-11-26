/**
 * @fileoverview Test fixtures for creating valid configuration data structures
 *
 * WHY FIXTURES:
 * - Ensures all required fields are present (prevents type errors)
 * - Provides consistent, realistic test data
 * - Easy to override specific fields for test scenarios
 * - Single source of truth for valid config structures
 *
 * USAGE:
 * ```ts
 * import { createApiStorageConfig } from '@tm/core/testing';
 *
 * // Create API storage config with defaults
 * const config = createApiStorageConfig();
 *
 * // Create with custom endpoint
 * const customConfig = createApiStorageConfig({
 *   storage: { apiEndpoint: 'https://custom.api.com' }
 * });
 * ```
 */

import type {
	IConfiguration,
	StorageSettings
} from '../common/interfaces/configuration.interface.js';

/**
 * Default storage settings for tests
 */
const defaultStorageSettings: Omit<StorageSettings, 'type'> = {
	enableBackup: false,
	maxBackups: 0,
	enableCompression: false,
	encoding: 'utf-8',
	atomicOperations: false
};

/**
 * Creates a valid StorageSettings object for API storage
 *
 * DEFAULTS:
 * - type: 'api'
 * - apiEndpoint: 'https://api.example.com'
 * - apiAccessToken: 'test-token'
 * - enableBackup: false
 * - maxBackups: 0
 * - enableCompression: false
 * - encoding: 'utf-8'
 * - atomicOperations: false
 */
export function createApiStorageSettings(
	overrides?: Partial<StorageSettings>
): StorageSettings {
	return {
		...defaultStorageSettings,
		type: 'api',
		apiEndpoint: 'https://api.example.com',
		apiAccessToken: 'test-token',
		...overrides
	};
}

/**
 * Creates a valid StorageSettings object for file storage
 *
 * DEFAULTS:
 * - type: 'file'
 * - basePath: '/test/project'
 * - enableBackup: false
 * - maxBackups: 0
 * - enableCompression: false
 * - encoding: 'utf-8'
 * - atomicOperations: false
 */
export function createFileStorageSettings(
	overrides?: Partial<StorageSettings>
): StorageSettings {
	return {
		...defaultStorageSettings,
		type: 'file',
		basePath: '/test/project',
		...overrides
	};
}

/**
 * Creates a partial IConfiguration with API storage settings
 *
 * DEFAULTS:
 * - storage: API storage with test endpoint and token
 * - projectPath: '/test/project'
 */
export function createApiStorageConfig(
	overrides?: Partial<{
		storage: Partial<StorageSettings>;
		projectPath: string;
	}>
): Partial<IConfiguration> {
	return {
		storage: createApiStorageSettings(overrides?.storage),
		projectPath: overrides?.projectPath ?? '/test/project'
	};
}

/**
 * Creates a partial IConfiguration with file storage settings
 *
 * DEFAULTS:
 * - storage: File storage with test base path
 * - projectPath: '/test/project'
 */
export function createFileStorageConfig(
	overrides?: Partial<{
		storage: Partial<StorageSettings>;
		projectPath: string;
	}>
): Partial<IConfiguration> {
	return {
		storage: createFileStorageSettings(overrides?.storage),
		projectPath: overrides?.projectPath ?? '/test/project'
	};
}

/**
 * Pre-built configuration scenarios for common test cases
 */
export const ConfigScenarios = {
	/**
	 * API storage with default test credentials
	 */
	apiStorage: () => createApiStorageConfig(),

	/**
	 * API storage with custom endpoint
	 */
	apiStorageCustomEndpoint: (endpoint: string) =>
		createApiStorageConfig({
			storage: { apiEndpoint: endpoint }
		}),

	/**
	 * File storage with default test path
	 */
	fileStorage: () => createFileStorageConfig(),

	/**
	 * File storage with custom base path
	 */
	fileStorageCustomPath: (basePath: string) =>
		createFileStorageConfig({
			storage: { basePath }
		}),

	/**
	 * Auto storage (will detect based on available config)
	 */
	autoStorage: () =>
		({
			storage: {
				...defaultStorageSettings,
				type: 'auto'
			},
			projectPath: '/test/project'
		}) as Partial<IConfiguration>
};
