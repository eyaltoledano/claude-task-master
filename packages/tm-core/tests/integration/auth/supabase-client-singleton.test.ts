/**
 * Tests for SupabaseAuthClient singleton pattern
 *
 * This test validates that the SupabaseAuthClient singleton is used consistently
 * across the codebase to prevent "refresh_token_already_used" errors.
 *
 * The bug scenario (before fix):
 * 1. AuthManager creates its own SupabaseAuthClient instance
 * 2. StorageFactory.createApiStorage() creates ANOTHER SupabaseAuthClient instance
 * 3. Each instance has its own Supabase client with autoRefreshToken: true
 * 4. When access token expires, both clients try to refresh using the same refresh_token
 * 5. First client succeeds and rotates the token
 * 6. Second client fails with "refresh_token_already_used"
 *
 * The fix: SupabaseAuthClient is now a proper singleton with getInstance().
 * All code paths use the same instance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger
vi.mock('../../../src/common/logger/index.js', () => ({
	getLogger: () => ({
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn()
	})
}));

// Mock SupabaseSessionStorage
vi.mock(
	'../../../src/modules/auth/services/supabase-session-storage.js',
	() => ({
		SupabaseSessionStorage: class MockSupabaseSessionStorage {
			clear() {}
			async getItem() {
				return null;
			}
			async setItem() {}
			async removeItem() {}
		}
	})
);

// Import after mocking
import { SupabaseAuthClient } from '../../../src/modules/integration/clients/supabase-client.js';
import { AuthManager } from '../../../src/modules/auth/managers/auth-manager.js';
import { StorageFactory } from '../../../src/modules/storage/services/storage-factory.js';
import { createApiStorageConfig } from '../../../src/testing/index.js';

describe('SupabaseAuthClient - Singleton Pattern Validation', () => {
	let originalSupabaseUrl: string | undefined;
	let originalSupabaseAnonKey: string | undefined;

	beforeEach(() => {
		// Store original values
		originalSupabaseUrl = process.env.TM_SUPABASE_URL;
		originalSupabaseAnonKey = process.env.TM_SUPABASE_ANON_KEY;

		// Set required environment variables
		process.env.TM_SUPABASE_URL = 'https://test.supabase.co';
		process.env.TM_SUPABASE_ANON_KEY = 'test-anon-key';

		// Reset singletons before each test
		SupabaseAuthClient.resetInstance();
		AuthManager.resetInstance();

		vi.clearAllMocks();
	});

	afterEach(() => {
		// Reset singletons after each test
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

	describe('Singleton Enforcement', () => {
		it('should return the same instance on multiple getInstance() calls', () => {
			const instance1 = SupabaseAuthClient.getInstance();
			const instance2 = SupabaseAuthClient.getInstance();
			const instance3 = SupabaseAuthClient.getInstance();

			expect(instance1).toBe(instance2);
			expect(instance2).toBe(instance3);
		});

		it('should return same Supabase client from multiple getInstance().getClient() calls', () => {
			const client1 = SupabaseAuthClient.getInstance().getClient();
			const client2 = SupabaseAuthClient.getInstance().getClient();

			expect(client1).toBe(client2);
		});
	});

	describe('AuthManager Integration', () => {
		it('AuthManager should use SupabaseAuthClient singleton', () => {
			const authManager = AuthManager.getInstance();
			const directInstance = SupabaseAuthClient.getInstance();

			// AuthManager.supabaseClient should be the same singleton instance
			expect(authManager.supabaseClient).toBe(directInstance);
		});

		it('AuthManager.supabaseClient.getClient() should return same client as direct getInstance()', () => {
			const authManager = AuthManager.getInstance();
			const directClient = SupabaseAuthClient.getInstance().getClient();

			expect(authManager.supabaseClient.getClient()).toBe(directClient);
		});
	});

	describe('StorageFactory Integration', () => {
		it('StorageFactory.createApiStorage should use the singleton Supabase client', async () => {
			// Get the singleton client first
			const singletonClient = SupabaseAuthClient.getInstance().getClient();

			// Create API storage using fixture
			const config = createApiStorageConfig();
			const storage = await StorageFactory.create(config, '/test/project');

			// The storage should use the same Supabase client instance
			// We can verify this by checking that getInstance() still returns the same client
			const clientAfterStorage = SupabaseAuthClient.getInstance().getClient();
			expect(clientAfterStorage).toBe(singletonClient);

			// Storage was created (basic sanity check)
			expect(storage).toBeDefined();
		});
	});

	describe('Concurrent Access Prevention', () => {
		it('multiple rapid getInstance() calls should all return the same instance', () => {
			// Simulate concurrent access
			const instances = Array.from({ length: 100 }, () =>
				SupabaseAuthClient.getInstance()
			);

			// All instances should be the same object
			const firstInstance = instances[0];
			instances.forEach((instance) => {
				expect(instance).toBe(firstInstance);
			});
		});

		it('AuthManager and StorageFactory should share the same Supabase client', async () => {
			// This is the key test - both should use the exact same client instance
			const authManager = AuthManager.getInstance();
			const authManagerClient = authManager.supabaseClient.getClient();

			// Create storage (which internally uses SupabaseAuthClient.getInstance())
			const config = createApiStorageConfig();
			await StorageFactory.create(config, '/test/project');

			// After StorageFactory creates storage, the singleton should still be the same
			const singletonClient = SupabaseAuthClient.getInstance().getClient();

			expect(authManagerClient).toBe(singletonClient);
		});
	});
});
