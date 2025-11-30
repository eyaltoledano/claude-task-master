/**
 * @fileoverview Integration tests for token refresh with singleton pattern
 *
 * These tests verify that the singleton SupabaseAuthClient prevents
 * "refresh_token_already_used" errors when multiple code paths
 * try to access the Supabase client with an expired token.
 *
 * The bug scenario (before fix):
 * 1. User authenticates, gets session with access_token + refresh_token
 * 2. Time passes (access token expires after ~1 hour)
 * 3. User runs a command like `tm show HAM-1945`
 * 4. AuthManager.hasValidSession() calls getSession() → triggers auto-refresh
 * 5. StorageFactory.createApiStorage() creates NEW SupabaseAuthClient
 * 6. This new client ALSO calls getSession() → triggers ANOTHER auto-refresh
 * 7. First refresh succeeds, rotates the token
 * 8. Second refresh fails with "refresh_token_already_used"
 *
 * The fix: SupabaseAuthClient is now a singleton, so all code paths
 * share the same Supabase client and there's only one auto-refresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	MockSupabaseSessionStorage,
	createApiStorageConfig,
	createMockLogger
} from '../../../src/testing/index.js';

// Mock logger using shared mock factory
vi.mock('../../../src/common/logger/index.js', () => ({
	getLogger: createMockLogger
}));

// Mock SupabaseSessionStorage using shared Map-based mock
// (this test may exercise storage behavior in future scenarios)
vi.mock(
	'../../../src/modules/auth/services/supabase-session-storage.js',
	() => ({
		SupabaseSessionStorage: MockSupabaseSessionStorage
	})
);

import { AuthManager } from '../../../src/modules/auth/managers/auth-manager.js';
// Import after mocking
import { SupabaseAuthClient } from '../../../src/modules/integration/clients/supabase-client.js';
import { StorageFactory } from '../../../src/modules/storage/services/storage-factory.js';

describe('Token Refresh - Singleton Integration', () => {
	let originalSupabaseUrl: string | undefined;
	let originalSupabaseAnonKey: string | undefined;

	beforeEach(() => {
		// Store original values
		originalSupabaseUrl = process.env.TM_SUPABASE_URL;
		originalSupabaseAnonKey = process.env.TM_SUPABASE_ANON_KEY;

		// Set required environment variables
		process.env.TM_SUPABASE_URL = 'https://test.supabase.co';
		process.env.TM_SUPABASE_ANON_KEY = 'test-anon-key';

		// Reset singletons
		SupabaseAuthClient.resetInstance();
		AuthManager.resetInstance();

		vi.clearAllMocks();
	});

	afterEach(() => {
		// Reset singletons
		SupabaseAuthClient.resetInstance();
		AuthManager.resetInstance();

		// Restore original env values
		if (originalSupabaseUrl === undefined) {
			delete process.env.TM_SUPABASE_URL;
		} else {
			process.env.TM_SUPABASE_URL = originalSupabaseUrl;
		}

		if (originalSupabaseAnonKey === undefined) {
			delete process.env.TM_SUPABASE_ANON_KEY;
		} else {
			process.env.TM_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
		}
	});

	describe('Simulated Expired Token Scenario', () => {
		it('should use only ONE Supabase client instance across AuthManager and StorageFactory', async () => {
			// Get the singleton instance and its internal client
			const supabaseAuthClient = SupabaseAuthClient.getInstance();
			const internalClient = supabaseAuthClient.getClient();

			// Get AuthManager (which uses the singleton)
			const authManager = AuthManager.getInstance();

			// Verify AuthManager uses the same singleton
			expect(authManager.supabaseClient).toBe(supabaseAuthClient);
			expect(authManager.supabaseClient.getClient()).toBe(internalClient);

			// Create API storage (which also uses the singleton)
			const config = createApiStorageConfig();
			await StorageFactory.create(config, '/test/project');

			// Verify the singleton still returns the same client
			expect(SupabaseAuthClient.getInstance().getClient()).toBe(internalClient);
		});

		it('should prevent multiple refresh token uses by sharing single client', async () => {
			// This test validates that the singleton pattern enables proper mock tracking.
			//
			// The key insight: with a singleton, we can spy on the single shared client
			// and verify that refresh is only called once. Before the singleton fix,
			// AuthManager and StorageFactory each created their own SupabaseAuthClient,
			// so we couldn't track refresh calls across all instances with a single spy.
			//
			// Note: This test explicitly calls refreshSession() once to verify the mock
			// infrastructure works. The actual race condition prevention is validated in
			// expired-token-refresh.test.ts which uses time-based simulation.

			const supabaseAuthClient = SupabaseAuthClient.getInstance();
			const internalClient = supabaseAuthClient.getClient();

			// Track how many times refreshSession would be called
			let mockRefreshCount = 0;
			vi.spyOn(internalClient.auth, 'refreshSession').mockImplementation(
				async () => {
					mockRefreshCount++;
					// Simulate successful refresh
					return {
						data: {
							session: {
								access_token: `new-token-${mockRefreshCount}`,
								refresh_token: `new-refresh-${mockRefreshCount}`,
								expires_in: 3600,
								expires_at: Math.floor(Date.now() / 1000) + 3600,
								token_type: 'bearer',
								user: {
									id: 'user-123',
									email: 'test@example.com',
									app_metadata: {},
									user_metadata: {},
									aud: 'authenticated',
									created_at: new Date().toISOString()
								}
							},
							user: null
						},
						error: null
					};
				}
			);

			// Verify AuthManager and StorageFactory share the same spied client
			const authManager = AuthManager.getInstance();
			const config = createApiStorageConfig();
			await StorageFactory.create(config, '/test/project');

			// Both should reference the same underlying Supabase client we spied on
			expect(authManager.supabaseClient.getClient()).toBe(internalClient);
			expect(SupabaseAuthClient.getInstance().getClient()).toBe(internalClient);

			// Now trigger one refresh - our single spy tracks it
			await supabaseAuthClient.refreshSession();

			// The key assertion: we can track refresh calls because there's only one client
			expect(mockRefreshCount).toBe(1);

			// Restore
			vi.mocked(internalClient.auth.refreshSession).mockRestore();
		});

		it('should allow multiple sequential refreshes on the same client', async () => {
			// This test verifies that sequential refreshes work correctly
			// (as opposed to the race condition from parallel refreshes)

			const supabaseAuthClient = SupabaseAuthClient.getInstance();
			const internalClient = supabaseAuthClient.getClient();

			let mockRefreshCount = 0;
			vi.spyOn(internalClient.auth, 'refreshSession').mockImplementation(
				async () => {
					mockRefreshCount++;
					return {
						data: {
							session: {
								access_token: `token-${mockRefreshCount}`,
								refresh_token: `refresh-${mockRefreshCount}`,
								expires_in: 3600,
								expires_at: Math.floor(Date.now() / 1000) + 3600,
								token_type: 'bearer',
								user: {
									id: 'user-123',
									email: 'test@example.com',
									app_metadata: {},
									user_metadata: {},
									aud: 'authenticated',
									created_at: new Date().toISOString()
								}
							},
							user: null
						},
						error: null
					};
				}
			);

			// Sequential refreshes should work fine
			const result1 = await supabaseAuthClient.refreshSession();
			const result2 = await supabaseAuthClient.refreshSession();

			expect(result1?.access_token).toBe('token-1');
			expect(result2?.access_token).toBe('token-2');
			expect(mockRefreshCount).toBe(2);

			vi.mocked(internalClient.auth.refreshSession).mockRestore();
		});
	});

	describe('Concurrent Access Safety', () => {
		it('getInstance() is safe to call from multiple places simultaneously', () => {
			// Simulate multiple parts of the codebase calling getInstance() at once
			const instances: SupabaseAuthClient[] = [];

			// Create 10 "concurrent" calls
			for (let i = 0; i < 10; i++) {
				instances.push(SupabaseAuthClient.getInstance());
			}

			// All should be the exact same instance
			const firstInstance = instances[0];
			for (const instance of instances) {
				expect(instance).toBe(firstInstance);
			}
		});

		it('AuthManager and StorageFactory always get the same underlying Supabase client', async () => {
			// This is the core fix validation

			// Step 1: AuthManager creates its singleton
			const authManager = AuthManager.getInstance();
			const authManagerClient = authManager.supabaseClient.getClient();

			// Step 2: StorageFactory creates API storage
			const config = createApiStorageConfig();
			await StorageFactory.create(config, '/test/project');

			// Step 3: Get the singleton client directly
			const singletonClient = SupabaseAuthClient.getInstance().getClient();

			// All three should be the exact same object
			expect(authManagerClient).toBe(singletonClient);

			// This is what the fix ensures: only ONE Supabase client exists
			// so there's only ONE autoRefreshToken handler
			// and only ONE possible refresh at a time
		});
	});
});
