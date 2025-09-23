/**
 * Test file documenting subpath export usage
 * This demonstrates how consumers can use granular imports for better tree-shaking
 */

import { describe, it, expect } from 'vitest';

describe('Subpath Exports', () => {
	it('should allow importing from auth subpath', async () => {
		// Instead of: import { AuthManager } from '@tm/core';
		// Use: import { AuthManager } from '@tm/core/auth';
		const authModule = await import('./auth');
		expect(authModule.AuthManager).toBeDefined();
		expect(authModule.AuthenticationError).toBeDefined();
	});

	it('should allow importing from storage subpath', async () => {
		// Instead of: import { FileStorage } from '@tm/core';
		// Use: import { FileStorage } from '@tm/core/storage';
		const storageModule = await import('./storage');
		expect(storageModule.FileStorage).toBeDefined();
		expect(storageModule.ApiStorage).toBeDefined();
		expect(storageModule.StorageFactory).toBeDefined();
	});

	it('should allow importing from config subpath', async () => {
		// Instead of: import { ConfigManager } from '@tm/core';
		// Use: import { ConfigManager } from '@tm/core/config';
		const configModule = await import('./config');
		expect(configModule.ConfigManager).toBeDefined();
	});

	it('should allow importing from errors subpath', async () => {
		// Instead of: import { TaskMasterError } from '@tm/core';
		// Use: import { TaskMasterError } from '@tm/core/errors';
		const errorsModule = await import('./errors');
		expect(errorsModule.TaskMasterError).toBeDefined();
		expect(errorsModule.ERROR_CODES).toBeDefined();
	});

	it('should allow importing from logger subpath', async () => {
		// Instead of: import { getLogger } from '@tm/core';
		// Use: import { getLogger } from '@tm/core/logger';
		const loggerModule = await import('./logger');
		expect(loggerModule.getLogger).toBeDefined();
		expect(loggerModule.createLogger).toBeDefined();
	});

	it('should allow importing from providers subpath', async () => {
		// Instead of: import { BaseProvider } from '@tm/core';
		// Use: import { BaseProvider } from '@tm/core/providers';
		const providersModule = await import('./providers');
		expect(providersModule.BaseProvider).toBeDefined();
	});

	it('should allow importing from services subpath', async () => {
		// Instead of: import { TaskService } from '@tm/core';
		// Use: import { TaskService } from '@tm/core/services';
		const servicesModule = await import('./services');
		expect(servicesModule.TaskService).toBeDefined();
	});

	it('should allow importing from utils subpath', async () => {
		// Instead of: import { generateId } from '@tm/core';
		// Use: import { generateId } from '@tm/core/utils';
		const utilsModule = await import('./utils');
		expect(utilsModule.generateId).toBeDefined();
	});
});

/**
 * Usage Examples for Consumers:
 *
 * 1. Import only authentication (smaller bundle):
 * ```typescript
 * import { AuthManager, AuthenticationError } from '@tm/core/auth';
 * ```
 *
 * 2. Import only storage (no auth code bundled):
 * ```typescript
 * import { FileStorage, StorageFactory } from '@tm/core/storage';
 * ```
 *
 * 3. Import only errors (minimal bundle):
 * ```typescript
 * import { TaskMasterError, ERROR_CODES } from '@tm/core/errors';
 * ```
 *
 * 4. Still support convenience imports (larger bundle but better DX):
 * ```typescript
 * import { AuthManager, FileStorage, TaskMasterError } from '@tm/core';
 * ```
 *
 * Benefits:
 * - Better tree-shaking: unused modules are not bundled
 * - Clearer dependencies: explicit about what parts of the library you use
 * - Faster builds: bundlers can optimize better with granular imports
 * - Smaller bundles: especially important for browser/edge deployments
 */
