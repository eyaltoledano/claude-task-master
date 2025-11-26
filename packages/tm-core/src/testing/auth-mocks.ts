/**
 * @fileoverview Shared mock implementations for auth-related tests
 *
 * These mocks provide consistent test doubles for Supabase authentication
 * components across unit and integration tests.
 *
 * USAGE:
 * ```ts
 * // In your test file, mock with the shared implementation
 * vi.mock('../path/to/supabase-session-storage.js', () => ({
 *   SupabaseSessionStorage: MockSupabaseSessionStorage
 * }));
 * ```
 */

/**
 * Mock implementation of SupabaseSessionStorage with in-memory Map storage.
 *
 * Use this for tests that need to exercise storage behavior (storing/retrieving sessions).
 * The Map-based implementation allows tests to verify session persistence.
 */
export class MockSupabaseSessionStorage {
	private data = new Map<string, string>();

	clear(): void {
		this.data.clear();
	}

	async getItem(key: string): Promise<string | null> {
		return this.data.get(key) ?? null;
	}

	async setItem(key: string, value: string): Promise<void> {
		this.data.set(key, value);
	}

	async removeItem(key: string): Promise<void> {
		this.data.delete(key);
	}
}

/**
 * Minimal mock implementation of SupabaseSessionStorage with no-op methods.
 *
 * Use this for tests that don't need to exercise storage behavior,
 * such as singleton pattern validation tests.
 */
export class MockSupabaseSessionStorageMinimal {
	clear(): void {}

	async getItem(): Promise<null> {
		return null;
	}

	async setItem(): Promise<void> {}

	async removeItem(): Promise<void> {}
}
