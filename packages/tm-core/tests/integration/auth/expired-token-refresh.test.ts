/**
 * @fileoverview Integration tests for expired token handling with time manipulation
 *
 * These tests use vi.setSystemTime to simulate real token expiration scenarios
 * and verify that:
 * 1. The singleton pattern prevents duplicate refresh attempts
 * 2. Token refresh is only called once even when multiple code paths access the client
 *
 * This tests the fix for "refresh_token_already_used" errors that occurred
 * when multiple SupabaseAuthClient instances each tried to refresh the same token.
 */

import { AuthError } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';
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

// Helper to create a session that expires at a specific time
const createSessionExpiringAt = (expiresAt: Date): Session => ({
	access_token: 'test-access-token',
	refresh_token: 'test-refresh-token',
	token_type: 'bearer',
	expires_in: 3600,
	expires_at: Math.floor(expiresAt.getTime() / 1000),
	user: {
		id: 'user-123',
		email: 'test@example.com',
		app_metadata: {},
		user_metadata: {},
		aud: 'authenticated',
		created_at: new Date().toISOString()
	} as User
});

// Helper to create a refreshed session
const createRefreshedSession = (): Session => ({
	access_token: 'new-access-token',
	refresh_token: 'new-refresh-token',
	token_type: 'bearer',
	expires_in: 3600,
	expires_at: Math.floor(Date.now() / 1000) + 3600,
	user: {
		id: 'user-123',
		email: 'test@example.com',
		app_metadata: {},
		user_metadata: {},
		aud: 'authenticated',
		created_at: new Date().toISOString()
	} as User
});

describe('Expired Token Refresh - Time-Based Integration', () => {
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
		// Restore real timers
		vi.useRealTimers();

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

	describe('Time-Based Token Expiration', () => {
		it('should detect expired token after time passes', () => {
			// Set a fixed "now" time
			const now = new Date('2024-01-15T10:00:00Z');
			vi.useFakeTimers();
			vi.setSystemTime(now);

			// Create a session that expires in 1 hour
			const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
			const session = createSessionExpiringAt(expiresAt);

			// Session should NOT be expired yet
			const currentTime = Math.floor(Date.now() / 1000);
			expect(session.expires_at).toBeGreaterThan(currentTime);

			// Jump forward 2 hours
			vi.setSystemTime(new Date(now.getTime() + 2 * 60 * 60 * 1000));

			// Now the session SHOULD be expired
			const newCurrentTime = Math.floor(Date.now() / 1000);
			expect(session.expires_at).toBeLessThan(newCurrentTime);
		});

		it('should share same singleton across time jumps', async () => {
			const now = new Date('2024-01-15T10:00:00Z');
			vi.useFakeTimers();
			vi.setSystemTime(now);

			// Get singleton at time T
			const client1 = SupabaseAuthClient.getInstance();

			// Jump forward 2 hours
			vi.setSystemTime(new Date(now.getTime() + 2 * 60 * 60 * 1000));

			// Get singleton at time T+2h - should be the same instance
			const client2 = SupabaseAuthClient.getInstance();

			expect(client1).toBe(client2);
		});
	});

	describe('Singleton Pattern with Expired Token Scenario', () => {
		it('should use same Supabase client regardless of when getInstance is called', async () => {
			const now = new Date('2024-01-15T10:00:00Z');
			vi.useFakeTimers();
			vi.setSystemTime(now);

			// Spy on getInstance to verify StorageFactory uses the singleton
			const getInstanceSpy = vi.spyOn(SupabaseAuthClient, 'getInstance');

			// Simulate the bug scenario:

			// T=0: User authenticates
			const supabaseAuthClient = SupabaseAuthClient.getInstance();
			const internalClient = supabaseAuthClient.getClient();

			// T=0: AuthManager is created
			const authManager = AuthManager.getInstance();
			expect(authManager.supabaseClient.getClient()).toBe(internalClient);

			const callsBeforeStorage = getInstanceSpy.mock.calls.length;

			// T+2h: Token expires, user runs a command
			vi.setSystemTime(new Date(now.getTime() + 2 * 60 * 60 * 1000));

			// StorageFactory creates API storage (which also accesses the singleton)
			const config = createApiStorageConfig();
			await StorageFactory.create(config, '/test/project');

			// REGRESSION GUARD: Verify StorageFactory called getInstance
			// If this fails, StorageFactory bypassed the singleton (the original bug)
			expect(getInstanceSpy.mock.calls.length).toBeGreaterThan(
				callsBeforeStorage
			);

			// CRITICAL: The singleton should still return the same client
			// Before the fix, StorageFactory would create a NEW SupabaseAuthClient
			expect(SupabaseAuthClient.getInstance().getClient()).toBe(internalClient);
			expect(authManager.supabaseClient.getClient()).toBe(internalClient);

			getInstanceSpy.mockRestore();
		});

		it('should track refresh calls on the single shared client', async () => {
			const now = new Date('2024-01-15T10:00:00Z');
			vi.useFakeTimers();
			vi.setSystemTime(now);

			// Spy on getInstance to verify both code paths use the singleton
			const getInstanceSpy = vi.spyOn(SupabaseAuthClient, 'getInstance');

			// Get the singleton
			const supabaseAuthClient = SupabaseAuthClient.getInstance();
			const internalClient = supabaseAuthClient.getClient();

			// Mock refreshSession to track calls
			let refreshCallCount = 0;
			vi.spyOn(internalClient.auth, 'refreshSession').mockImplementation(
				async (_options?: { refresh_token: string }) => {
					refreshCallCount++;
					return {
						data: {
							session: createRefreshedSession(),
							user: createRefreshedSession().user
						},
						error: null
					};
				}
			);

			// T+2h: Token expires
			vi.setSystemTime(new Date(now.getTime() + 2 * 60 * 60 * 1000));

			const callsBeforeAccess = getInstanceSpy.mock.calls.length;

			// Multiple code paths access the singleton
			const authManager = AuthManager.getInstance();
			const config = createApiStorageConfig();
			await StorageFactory.create(config, '/test/project');

			// REGRESSION GUARD: Verify both AuthManager and StorageFactory called getInstance
			// This proves they're using the singleton rather than creating independent clients
			expect(getInstanceSpy.mock.calls.length).toBeGreaterThan(
				callsBeforeAccess
			);

			// Trigger refresh from one path
			await supabaseAuthClient.refreshSession();

			// The key assertion: refreshCallCount is 1 because:
			// 1. StorageFactory.create and AuthManager.getInstance don't trigger refresh on their own
			// 2. Only the explicit refreshSession() call above triggered refresh
			// 3. Because all code paths share the same SupabaseAuthClient singleton,
			//    we can spy on a single mock and verify no other code path called refresh.
			// Before the singleton fix, StorageFactory would create a new client that could
			// trigger its own independent refresh, leading to "refresh_token_already_used" errors.
			expect(refreshCallCount).toBe(1);

			// Verify it's the same client everywhere
			expect(authManager.supabaseClient.getClient()).toBe(internalClient);

			vi.mocked(internalClient.auth.refreshSession).mockRestore();
			getInstanceSpy.mockRestore();
		});

		it('should prevent the "refresh_token_already_used" race condition', async () => {
			const now = new Date('2024-01-15T10:00:00Z');
			vi.useFakeTimers();
			vi.setSystemTime(now);

			// Spy on getInstance to verify all code paths use the singleton
			const getInstanceSpy = vi.spyOn(SupabaseAuthClient, 'getInstance');

			// Get the singleton
			const supabaseAuthClient = SupabaseAuthClient.getInstance();
			const internalClient = supabaseAuthClient.getClient();

			// Track refresh attempts
			let refreshCallCount = 0;

			// Simulate Supabase's behavior: first refresh rotates the token,
			// subsequent refreshes with the OLD token fail
			vi.spyOn(internalClient.auth, 'refreshSession').mockImplementation(
				async (_options?: { refresh_token: string }) => {
					refreshCallCount++;
					if (refreshCallCount === 1) {
						// First refresh succeeds
						return {
							data: {
								session: createRefreshedSession(),
								user: createRefreshedSession().user
							},
							error: null
						};
					} else {
						// If this were a second client with the old token, it would fail
						// This simulates the "refresh_token_already_used" error
						return {
							data: { session: null, user: null },
							error: new AuthError('Invalid Refresh Token: Already Used', 400)
						};
					}
				}
			);

			// T+2h: Token expires
			vi.setSystemTime(new Date(now.getTime() + 2 * 60 * 60 * 1000));

			const callsBeforeFlow = getInstanceSpy.mock.calls.length;

			// Simulate the typical command flow:
			// 1. AuthManager checks session
			const authManager = AuthManager.getInstance();

			// 2. StorageFactory creates storage
			const config = createApiStorageConfig();
			await StorageFactory.create(config, '/test/project');

			// REGRESSION GUARD: Both code paths must use the singleton
			expect(getInstanceSpy.mock.calls.length).toBeGreaterThan(callsBeforeFlow);

			// 3. One of them triggers a refresh
			const result1 = await authManager.supabaseClient.refreshSession();

			// With singleton pattern, first refresh succeeds
			expect(result1?.access_token).toBe('new-access-token');
			expect(refreshCallCount).toBe(1);

			// If we HAD multiple clients (the bug), a second client would try to
			// refresh with the now-rotated token and fail.
			// With singleton, subsequent calls go through the same (now refreshed) client.

			vi.mocked(internalClient.auth.refreshSession).mockRestore();
			getInstanceSpy.mockRestore();
		});
	});

	describe('Real-World Command Simulation', () => {
		it('simulates tm show HAM-1945 after 1 hour idle', async () => {
			// This test simulates the exact scenario from the bug report
			const loginTime = new Date('2024-01-15T09:00:00Z');
			vi.useFakeTimers();
			vi.setSystemTime(loginTime);

			// Spy on getInstance to verify StorageFactory uses the singleton
			const getInstanceSpy = vi.spyOn(SupabaseAuthClient, 'getInstance');

			// User logs in at 9:00 AM
			const authManager = AuthManager.getInstance();
			const supabaseClient = authManager.supabaseClient.getClient();

			// Track refresh calls
			let refreshCount = 0;
			vi.spyOn(supabaseClient.auth, 'refreshSession').mockImplementation(
				async (_options?: { refresh_token: string }) => {
					refreshCount++;
					return {
						data: {
							session: createRefreshedSession(),
							user: createRefreshedSession().user
						},
						error: null
					};
				}
			);

			// User comes back at 10:15 AM (token expired at 10:00 AM)
			const commandTime = new Date('2024-01-15T10:15:00Z');
			vi.setSystemTime(commandTime);

			const callsBeforeCommand = getInstanceSpy.mock.calls.length;

			// User runs: tm show HAM-1945
			// This triggers:
			// 1. AuthManager.hasValidSession() -> getSession() -> auto-refresh
			// 2. StorageFactory.createApiStorage() -> gets singleton (NOT new client)

			// Simulate the command flow
			const config = createApiStorageConfig();
			await StorageFactory.create(config, '/test/project');

			// REGRESSION GUARD: StorageFactory must call getInstance (not create its own client)
			expect(getInstanceSpy.mock.calls.length).toBeGreaterThan(
				callsBeforeCommand
			);

			// If we trigger a refresh, it should only happen once
			await authManager.supabaseClient.refreshSession();

			// Before the fix: refreshCount would be 2 (race condition)
			// After the fix: refreshCount is 1 (singleton prevents race)
			expect(refreshCount).toBe(1);

			// Verify singleton is maintained
			expect(SupabaseAuthClient.getInstance()).toBe(authManager.supabaseClient);

			vi.mocked(supabaseClient.auth.refreshSession).mockRestore();
			getInstanceSpy.mockRestore();
		});
	});
});
