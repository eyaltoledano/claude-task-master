/**
 * Tests for AuthManager singleton behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the logger to verify warnings (must be hoisted before SUT import)
const mockLogger = {
	warn: vi.fn(),
	info: vi.fn(),
	debug: vi.fn(),
	error: vi.fn()
};

vi.mock('../../../common/logger/index.js', () => ({
	getLogger: () => mockLogger
}));

// Mock ContextStore instead of the deprecated CredentialStore
const ContextStoreSpy = vi.fn();
vi.mock('../services/context-store.js', () => {
	return {
		ContextStore: class {
			static getInstance(config?: any) {
				return new (this as any)(config);
			}
			static resetInstance() {
				// Mock reset instance method
			}
			constructor(config?: any) {
				ContextStoreSpy(config);
			}
			getContext() {
				return null;
			}
			saveContext() {}
			clearContext() {}
			getUserContext() {
				return null;
			}
		}
	};
});

// Mock OAuthService to avoid side effects
vi.mock('../services/oauth-service.js', () => {
	return {
		OAuthService: class {
			constructor() {}
			authenticate() {
				return Promise.resolve({});
			}
			getAuthorizationUrl() {
				return null;
			}
		}
	};
});

// Mock SupabaseAuthClient to avoid side effects
vi.mock('../../integration/clients/supabase-client.js', () => {
	return {
		SupabaseAuthClient: class {
			constructor() {}
			initialize() {
				return Promise.resolve();
			}
			getSession() {
				return Promise.resolve(null);
			}
			refreshSession() {
				return Promise.resolve({});
			}
			signOut() {
				return Promise.resolve();
			}
		}
	};
});

// Import SUT after mocks
import { AuthManager } from './auth-manager.js';

describe('AuthManager Singleton', () => {
	beforeEach(() => {
		// Reset singleton before each test
		AuthManager.resetInstance();
		vi.clearAllMocks();
		ContextStoreSpy.mockClear();
	});

	it('should return the same instance on multiple calls', () => {
		const instance1 = AuthManager.getInstance();
		const instance2 = AuthManager.getInstance();

		expect(instance1).toBe(instance2);
	});

	it('should use config on first call', async () => {
		const config = {
			baseUrl: 'https://test.auth.com',
			configDir: '/test/config',
			configFile: '/test/config/auth.json'
		};

		const instance = AuthManager.getInstance(config);
		expect(instance).toBeDefined();

		// Assert that ContextStore was constructed (it doesn't take config parameter)
		expect(ContextStoreSpy).toHaveBeenCalledTimes(1);

		// Verify the instance is properly initialized
		const credentials = await instance.getAuthCredentials();
		expect(credentials).toBeNull(); // No session exists yet
	});

	it('should warn when config is provided after initialization', () => {
		// Clear previous calls
		mockLogger.warn.mockClear();

		// First call with config
		AuthManager.getInstance({ baseUrl: 'https://first.auth.com' });

		// Second call with different config
		AuthManager.getInstance({ baseUrl: 'https://second.auth.com' });

		// Verify warning was logged
		expect(mockLogger.warn).toHaveBeenCalledWith(
			expect.stringMatching(/config.*after initialization.*ignored/i)
		);
	});

	it('should not warn when no config is provided after initialization', () => {
		// Clear previous calls
		mockLogger.warn.mockClear();

		// First call with config
		AuthManager.getInstance({ configDir: '/test/config' });

		// Second call without config
		AuthManager.getInstance();

		// Verify no warning was logged
		expect(mockLogger.warn).not.toHaveBeenCalled();
	});

	it('should allow resetting the instance', () => {
		const instance1 = AuthManager.getInstance();

		// Reset the instance
		AuthManager.resetInstance();

		// Get new instance
		const instance2 = AuthManager.getInstance();

		// They should be different instances
		expect(instance1).not.toBe(instance2);
	});
});
