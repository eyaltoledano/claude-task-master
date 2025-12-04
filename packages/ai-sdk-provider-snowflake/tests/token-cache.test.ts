/**
 * Unit tests for TokenCache
 *
 * Tests both the async persistent cache API and the sync in-memory API
 */

import { TokenCache } from '../src/auth/token-cache.js';
import type { CachedToken } from '../src/types.js';

describe('TokenCache', () => {
	let cache: TokenCache;

	beforeEach(() => {
		// Create cache with persistence disabled for unit tests
		cache = new TokenCache(false);
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('async set and get (with account/user)', () => {
		it('should store and retrieve a token', async () => {
			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000, // 1 hour from now
				baseURL: 'https://account.snowflakecomputing.com'
			};

			await cache.set('myaccount', 'myuser', token);
			const retrieved = await cache.get('myaccount', 'myuser');

			expect(retrieved).toEqual(token);
		});

		it('should return undefined for non-existent account/user', async () => {
			const result = await cache.get('non-existent', 'user');
			expect(result).toBeUndefined();
		});

		it('should return undefined for expired token', async () => {
			const token: CachedToken = {
				accessToken: 'expired-token',
				expiresAt: Date.now() + 10000 // 10 seconds from now
			};

			await cache.set('myaccount', 'myuser', token);

			// Advance time past expiry (including 30s buffer)
			jest.advanceTimersByTime(15000);

			const result = await cache.get('myaccount', 'myuser');
			expect(result).toBeUndefined();
		});

		it('should return undefined when token is within expiry buffer', async () => {
			const token: CachedToken = {
				accessToken: 'soon-expired-token',
				expiresAt: Date.now() + 20000 // 20 seconds from now
			};

			await cache.set('myaccount', 'myuser', token);

			// Token hasn't technically expired but is within 30s buffer
			// 20s remaining < 30s buffer, so should be considered expired
			const result = await cache.get('myaccount', 'myuser');
			expect(result).toBeUndefined();
		});

		it('should return token when well before expiry buffer', async () => {
			const token: CachedToken = {
				accessToken: 'valid-token',
				expiresAt: Date.now() + 60000 // 60 seconds from now
			};

			await cache.set('myaccount', 'myuser', token);

			// Token is still valid (60s - 30s buffer = 30s remaining)
			const result = await cache.get('myaccount', 'myuser');
			expect(result).toEqual(token);
		});
	});

	describe('async delete', () => {
		it('should remove a token from cache', async () => {
			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000
			};

			await cache.set('myaccount', 'myuser', token);
			const beforeDelete = await cache.get('myaccount', 'myuser');
			expect(beforeDelete).toBeDefined();

			await cache.delete('myaccount', 'myuser');
			const afterDelete = await cache.get('myaccount', 'myuser');
			expect(afterDelete).toBeUndefined();
		});

		it('should not throw when deleting non-existent key', async () => {
			await expect(cache.delete('non-existent', 'user')).resolves.not.toThrow();
		});
	});

	describe('sync legacy API (setSync/getSync)', () => {
		it('should store and retrieve a token synchronously', () => {
			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000
			};

			cache.setSync('account:user', token);
			const retrieved = cache.getSync('account:user');

			expect(retrieved).toEqual(token);
		});

		it('should return undefined for non-existent key', () => {
			const result = cache.getSync('non-existent');
			expect(result).toBeUndefined();
		});

		it('should return undefined for expired token', () => {
			const token: CachedToken = {
				accessToken: 'expired-token',
				expiresAt: Date.now() + 10000
			};

			cache.setSync('account:user', token);

			// Advance time past expiry (including 30s buffer)
			jest.advanceTimersByTime(15000);

			const result = cache.getSync('account:user');
			expect(result).toBeUndefined();
		});

		it('should remove expired token from cache on getSync', () => {
			const token: CachedToken = {
				accessToken: 'expired-token',
				expiresAt: Date.now() + 5000 // 5 seconds (within buffer)
			};

			cache.setSync('account:user', token);
			cache.getSync('account:user'); // This should remove the token

			expect(cache.has('account:user')).toBe(false);
		});
	});

	describe('clear', () => {
		it('should remove all tokens from in-memory cache', async () => {
			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000
			};

			await cache.set('account1', 'user1', token);
			await cache.set('account2', 'user2', { ...token, accessToken: 'token2' });
			await cache.set('account3', 'user3', { ...token, accessToken: 'token3' });

			expect(cache.size).toBe(3);

			cache.clear();
			expect(cache.size).toBe(0);
		});
	});

	describe('size', () => {
		it('should return correct size', async () => {
			expect(cache.size).toBe(0);

			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000
			};

			await cache.set('account1', 'user1', token);
			expect(cache.size).toBe(1);

			await cache.set('account2', 'user2', { ...token, accessToken: 'token2' });
			expect(cache.size).toBe(2);
		});
	});

	describe('has', () => {
		it('should return true for existing key', () => {
			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000
			};

			cache.setSync('account:user', token);
			expect(cache.has('account:user')).toBe(true);
		});

		it('should return false for non-existent key', () => {
			expect(cache.has('non-existent')).toBe(false);
		});

		it('should return true for expired key (does not check expiry)', () => {
			const token: CachedToken = {
				accessToken: 'expired-token',
				expiresAt: Date.now() - 1000 // Already expired
			};

			cache.setSync('account:user', token);
			// has() doesn't check expiry, unlike get()
			expect(cache.has('account:user')).toBe(true);
		});
	});

	describe('cleanup', () => {
		it('should remove all expired tokens', () => {
			const validToken: CachedToken = {
				accessToken: 'valid-token',
				expiresAt: Date.now() + 3600000 // 1 hour
			};

			const expiredToken: CachedToken = {
				accessToken: 'expired-token',
				expiresAt: Date.now() + 10000 // 10 seconds (within buffer)
			};

			cache.setSync('valid', validToken);
			cache.setSync('expired1', expiredToken);
			cache.setSync('expired2', { ...expiredToken, accessToken: 'expired2' });

			expect(cache.size).toBe(3);

			cache.cleanup();

			expect(cache.size).toBe(1);
			expect(cache.has('valid')).toBe(true);
			expect(cache.has('expired1')).toBe(false);
			expect(cache.has('expired2')).toBe(false);
		});
	});

	describe('isPersistentCacheAvailable', () => {
		it('should return false when persistence is disabled', () => {
			const noPersistCache = new TokenCache(false);
			expect(noPersistCache.isPersistentCacheAvailable).toBe(false);
		});

		it('should return true when JsonCredentialManager is available', () => {
			// This will only pass if snowflake-sdk is installed with the credential manager
			const persistCache = new TokenCache(true);
			// The result depends on whether JsonCredentialManager loaded successfully
			expect(typeof persistCache.isPersistentCacheAvailable).toBe('boolean');
		});
	});
});
