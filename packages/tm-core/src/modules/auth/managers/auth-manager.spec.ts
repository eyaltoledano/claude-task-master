/**
 * Tests for AuthManager singleton behavior
 *
 * Mocking strategy (per @tm/core guidelines):
 * - Mock external I/O: SupabaseAuthClient (API), SessionManager (filesystem), OAuthService (OAuth APIs)
 * - Mock side effects: logger (acceptable for unit tests)
 * - Mock internal services: ContextStore (TODO: evaluate if real instance can be used)
 *
 * Note: Mocking 5 dependencies is a code smell suggesting AuthManager may have too many responsibilities.
 * Consider refactoring to reduce coupling in the future.
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
	let instance: any = null;
	return {
		SupabaseAuthClient: class {
			constructor() {}
			static getInstance() {
				if (!instance) {
					instance = new (this as any)();
				}
				return instance;
			}
			static resetInstance() {
				instance = null;
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

import { AuthenticationError } from '../types.js';
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

describe('AuthManager - MFA Retry Logic', () => {
	beforeEach(() => {
		AuthManager.resetInstance();
		vi.clearAllMocks();
	});

	describe('verifyMFAWithRetry', () => {
		it('should succeed on first attempt with valid code', async () => {
			const authManager = AuthManager.getInstance();
			let callCount = 0;

			// Mock code provider
			const codeProvider = vi.fn(async () => {
				callCount++;
				return '123456';
			});

			// Mock successful verification
			vi.spyOn(authManager, 'verifyMFA').mockResolvedValue({
				token: 'test-token',
				userId: 'test-user',
				email: 'test@example.com',
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			});

			const result = await authManager.verifyMFAWithRetry(
				'factor-123',
				codeProvider,
				{ maxAttempts: 3 }
			);

			expect(result.success).toBe(true);
			expect(result.attemptsUsed).toBe(1);
			expect(result.credentials).toBeDefined();
			expect(result.credentials?.token).toBe('test-token');
			expect(codeProvider).toHaveBeenCalledTimes(1);
		});

		it('should retry on INVALID_MFA_CODE and succeed on second attempt', async () => {
			const authManager = AuthManager.getInstance();
			let attemptCount = 0;

			// Mock code provider
			const codeProvider = vi.fn(async () => {
				attemptCount++;
				return `code-${attemptCount}`;
			});

			// Mock verification: fail once, then succeed
			const verifyMFASpy = vi
				.spyOn(authManager, 'verifyMFA')
				.mockRejectedValueOnce(
					new AuthenticationError('Invalid MFA code', 'INVALID_MFA_CODE')
				)
				.mockResolvedValueOnce({
					token: 'test-token',
					userId: 'test-user',
					email: 'test@example.com',
					tokenType: 'standard',
					savedAt: new Date().toISOString()
				});

			const result = await authManager.verifyMFAWithRetry(
				'factor-123',
				codeProvider,
				{ maxAttempts: 3 }
			);

			expect(result.success).toBe(true);
			expect(result.attemptsUsed).toBe(2);
			expect(result.credentials).toBeDefined();
			expect(codeProvider).toHaveBeenCalledTimes(2);
			expect(verifyMFASpy).toHaveBeenCalledTimes(2);
		});

		it('should fail after max attempts with INVALID_MFA_CODE', async () => {
			const authManager = AuthManager.getInstance();
			const codeProvider = vi.fn(async () => '000000');

			// Mock verification to always fail
			vi.spyOn(authManager, 'verifyMFA').mockRejectedValue(
				new AuthenticationError('Invalid MFA code', 'INVALID_MFA_CODE')
			);

			const result = await authManager.verifyMFAWithRetry(
				'factor-123',
				codeProvider,
				{ maxAttempts: 3 }
			);

			expect(result.success).toBe(false);
			expect(result.attemptsUsed).toBe(3);
			expect(result.credentials).toBeUndefined();
			expect(result.errorCode).toBe('INVALID_MFA_CODE');
			expect(codeProvider).toHaveBeenCalledTimes(3);
		});

		it('should throw immediately on non-INVALID_MFA_CODE errors', async () => {
			const authManager = AuthManager.getInstance();
			const codeProvider = vi.fn(async () => '123456');

			// Mock verification to throw different error
			const networkError = new AuthenticationError(
				'Network error',
				'NETWORK_ERROR'
			);
			vi.spyOn(authManager, 'verifyMFA').mockRejectedValue(networkError);

			await expect(
				authManager.verifyMFAWithRetry('factor-123', codeProvider, {
					maxAttempts: 3
				})
			).rejects.toThrow('Network error');

			// Should not retry on non-INVALID_MFA_CODE errors
			expect(codeProvider).toHaveBeenCalledTimes(1);
		});

		it('should respect custom maxAttempts parameter', async () => {
			const authManager = AuthManager.getInstance();
			const codeProvider = vi.fn(async () => '000000');

			// Mock verification to always fail
			vi.spyOn(authManager, 'verifyMFA').mockRejectedValue(
				new AuthenticationError('Invalid MFA code', 'INVALID_MFA_CODE')
			);

			const result = await authManager.verifyMFAWithRetry(
				'factor-123',
				codeProvider,
				{ maxAttempts: 5 } // Custom max attempts
			);

			expect(result.success).toBe(false);
			expect(result.attemptsUsed).toBe(5);
			expect(codeProvider).toHaveBeenCalledTimes(5);
		});

		it('should use default maxAttempts of 3', async () => {
			const authManager = AuthManager.getInstance();
			const codeProvider = vi.fn(async () => '000000');

			vi.spyOn(authManager, 'verifyMFA').mockRejectedValue(
				new AuthenticationError('Invalid MFA code', 'INVALID_MFA_CODE')
			);

			// Don't pass options - should default to 3
			const result = await authManager.verifyMFAWithRetry(
				'factor-123',
				codeProvider
			);

			expect(result.success).toBe(false);
			expect(result.attemptsUsed).toBe(3);
			expect(codeProvider).toHaveBeenCalledTimes(3);
		});

		it('should throw TypeError on invalid maxAttempts (0 or negative)', async () => {
			const authManager = AuthManager.getInstance();
			const codeProvider = vi.fn(async () => '123456');

			// Test with 0
			await expect(
				authManager.verifyMFAWithRetry('factor-123', codeProvider, {
					maxAttempts: 0
				})
			).rejects.toThrow(TypeError);

			await expect(
				authManager.verifyMFAWithRetry('factor-123', codeProvider, {
					maxAttempts: 0
				})
			).rejects.toThrow(
				'Invalid maxAttempts value: 0. Must be a positive integer.'
			);

			// Test with negative
			await expect(
				authManager.verifyMFAWithRetry('factor-123', codeProvider, {
					maxAttempts: -1
				})
			).rejects.toThrow(TypeError);

			await expect(
				authManager.verifyMFAWithRetry('factor-123', codeProvider, {
					maxAttempts: -1
				})
			).rejects.toThrow(
				'Invalid maxAttempts value: -1. Must be a positive integer.'
			);

			// Verify code provider was never called
			expect(codeProvider).not.toHaveBeenCalled();
		});

		it('should invoke onInvalidCode callback when invalid code is entered', async () => {
			const authManager = AuthManager.getInstance();
			const codeProvider = vi.fn(async () => '000000');
			const onInvalidCode = vi.fn();

			// Mock verification to always fail
			vi.spyOn(authManager, 'verifyMFA').mockRejectedValue(
				new AuthenticationError('Invalid MFA code', 'INVALID_MFA_CODE')
			);

			await authManager.verifyMFAWithRetry('factor-123', codeProvider, {
				maxAttempts: 3,
				onInvalidCode
			});

			// Should be called 3 times (after each failed attempt)
			expect(onInvalidCode).toHaveBeenCalledTimes(3);

			// Verify callback arguments: (attempt, remaining)
			expect(onInvalidCode).toHaveBeenNthCalledWith(1, 1, 2); // 1st attempt, 2 remaining
			expect(onInvalidCode).toHaveBeenNthCalledWith(2, 2, 1); // 2nd attempt, 1 remaining
			expect(onInvalidCode).toHaveBeenNthCalledWith(3, 3, 0); // 3rd attempt, 0 remaining
		});

		it('should not invoke onInvalidCode callback on successful verification', async () => {
			const authManager = AuthManager.getInstance();
			const codeProvider = vi.fn(async () => '123456');
			const onInvalidCode = vi.fn();

			// Mock successful verification
			vi.spyOn(authManager, 'verifyMFA').mockResolvedValue({
				token: 'test-token',
				userId: 'test-user',
				email: 'test@example.com',
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			});

			const result = await authManager.verifyMFAWithRetry(
				'factor-123',
				codeProvider,
				{
					maxAttempts: 3,
					onInvalidCode
				}
			);

			expect(result.success).toBe(true);
			expect(onInvalidCode).not.toHaveBeenCalled();
		});

		it('should work without onInvalidCode callback (backward compatibility)', async () => {
			const authManager = AuthManager.getInstance();
			const codeProvider = vi.fn(async () => '123456');

			// Mock successful verification
			vi.spyOn(authManager, 'verifyMFA').mockResolvedValue({
				token: 'test-token',
				userId: 'test-user',
				email: 'test@example.com',
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			});

			// Call without onInvalidCode - should not throw
			const result = await authManager.verifyMFAWithRetry(
				'factor-123',
				codeProvider,
				{
					maxAttempts: 3
				}
			);

			expect(result.success).toBe(true);
		});

		it('should invoke onInvalidCode with correct remaining attempts', async () => {
			const authManager = AuthManager.getInstance();
			let attemptCount = 0;
			const codeProvider = vi.fn(async () => {
				attemptCount++;
				return `code-${attemptCount}`;
			});
			const onInvalidCode = vi.fn();

			// Fail twice, then succeed
			vi.spyOn(authManager, 'verifyMFA')
				.mockRejectedValueOnce(
					new AuthenticationError('Invalid MFA code', 'INVALID_MFA_CODE')
				)
				.mockRejectedValueOnce(
					new AuthenticationError('Invalid MFA code', 'INVALID_MFA_CODE')
				)
				.mockResolvedValueOnce({
					token: 'test-token',
					userId: 'test-user',
					email: 'test@example.com',
					tokenType: 'standard',
					savedAt: new Date().toISOString()
				});

			const result = await authManager.verifyMFAWithRetry(
				'factor-123',
				codeProvider,
				{
					maxAttempts: 3,
					onInvalidCode
				}
			);

			expect(result.success).toBe(true);
			expect(result.attemptsUsed).toBe(3);

			// Verify callback was called for the first two failed attempts
			expect(onInvalidCode).toHaveBeenCalledTimes(2);
			expect(onInvalidCode).toHaveBeenNthCalledWith(1, 1, 2); // 1st attempt, 2 remaining
			expect(onInvalidCode).toHaveBeenNthCalledWith(2, 2, 1); // 2nd attempt, 1 remaining
		});
	});
});
