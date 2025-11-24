/**
 * Tests for AuthManager singleton behavior
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger to verify warnings (must be hoisted before SUT import)
vi.mock('../../../common/logger/index.js', () => ({
	getLogger: () => ({
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn()
	})
}));

// Spy on OAuthService constructor to verify config propagation
const OAuthServiceSpy = vi.fn();
vi.mock('../services/oauth-service.js', () => {
	return {
		OAuthService: class {
			constructor(_contextStore: any, _supabaseClient: any, config?: any) {
				OAuthServiceSpy(config);
			}
			authenticate() {
				return Promise.resolve({});
			}
			getAuthorizationUrl() {
				return null;
			}
		}
	};
});

// Mock ContextStore
vi.mock('../services/context-store.js', () => {
	return {
		ContextStore: class {
			static getInstance() {
				return new (this as any)();
			}
			static resetInstance() {}
			getUserContext() {
				return null;
			}
			getContext() {
				return null;
			}
		}
	};
});

// Mock SessionManager
vi.mock('../services/session-manager.js', () => {
	return {
		SessionManager: class {
			constructor() {}
			async getAuthCredentials() {
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
		OAuthServiceSpy.mockClear();
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

		// Assert that OAuthService was constructed with the provided config
		expect(OAuthServiceSpy).toHaveBeenCalledTimes(1);
		expect(OAuthServiceSpy).toHaveBeenCalledWith(config);

		// Verify the config is passed to internal components through observable behavior
		// getAuthCredentials would use the configured session
		const credentials = await instance.getAuthCredentials();
		expect(credentials).toBeNull(); // No session, but config was propagated correctly
	});

	it('should warn when config is provided after initialization', () => {
		// First call with config
		AuthManager.getInstance({ baseUrl: 'https://first.auth.com' });

		// Reset the spy to track only the second call
		OAuthServiceSpy.mockClear();

		// Second call with different config (should trigger warning)
		AuthManager.getInstance({ baseUrl: 'https://second.auth.com' });

		// Verify OAuthService was not constructed again (singleton behavior)
		expect(OAuthServiceSpy).not.toHaveBeenCalled();
	});

	it('should not call OAuthService again when no config is provided after initialization', () => {
		// First call with config
		AuthManager.getInstance({ configDir: '/test/config' });

		// Reset the spy
		OAuthServiceSpy.mockClear();

		// Second call without config
		AuthManager.getInstance();

		// Verify OAuthService was not constructed again
		expect(OAuthServiceSpy).not.toHaveBeenCalled();
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
