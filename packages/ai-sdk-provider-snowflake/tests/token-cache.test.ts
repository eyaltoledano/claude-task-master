/**
 * Unit tests for TokenCache
 */

import { TokenCache } from '../src/auth/token-cache.js';
import type { CachedToken } from '../src/types.js';

describe('TokenCache', () => {
	let cache: TokenCache;

	beforeEach(() => {
		cache = new TokenCache();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('set and get', () => {
		it('should store and retrieve a token', () => {
			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000, // 1 hour from now
				baseURL: 'https://account.snowflakecomputing.com'
			};

			cache.set('myaccount', 'myuser', token);
			const retrieved = cache.get('myaccount', 'myuser');

			expect(retrieved).toEqual(token);
		});

		it('should return undefined for non-existent account/user', () => {
			const result = cache.get('non-existent', 'user');
			expect(result).toBeUndefined();
		});

		it('should return undefined for expired token', () => {
			const token: CachedToken = {
				accessToken: 'expired-token',
				expiresAt: Date.now() + 10000 // 10 seconds from now
			};

			cache.set('myaccount', 'myuser', token);

			// Advance time past expiry (including 30s buffer)
			jest.advanceTimersByTime(15000);

			const result = cache.get('myaccount', 'myuser');
			expect(result).toBeUndefined();
		});

		it('should return undefined when token is within expiry buffer', () => {
			const token: CachedToken = {
				accessToken: 'soon-expired-token',
				expiresAt: Date.now() + 20000 // 20 seconds from now
			};

			cache.set('myaccount', 'myuser', token);

			// Token hasn't technically expired but is within 30s buffer
			// 20s remaining < 30s buffer, so should be considered expired
			const result = cache.get('myaccount', 'myuser');
			expect(result).toBeUndefined();
		});

		it('should return token when well before expiry buffer', () => {
			const token: CachedToken = {
				accessToken: 'valid-token',
				expiresAt: Date.now() + 60000 // 60 seconds from now
			};

			cache.set('myaccount', 'myuser', token);

			// Token is still valid (60s - 30s buffer = 30s remaining)
			const result = cache.get('myaccount', 'myuser');
			expect(result).toEqual(token);
		});

		it('should be case-insensitive for account and user', () => {
			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000
			};

			cache.set('MyAccount', 'MyUser', token);

			expect(cache.get('myaccount', 'myuser')).toEqual(token);
			expect(cache.get('MYACCOUNT', 'MYUSER')).toEqual(token);
		});
	});

	describe('delete', () => {
		it('should remove a token from cache', () => {
			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000
			};

			cache.set('myaccount', 'myuser', token);
			expect(cache.get('myaccount', 'myuser')).toBeDefined();

			cache.delete('myaccount', 'myuser');
			expect(cache.get('myaccount', 'myuser')).toBeUndefined();
		});

		it('should not throw when deleting non-existent key', () => {
			expect(() => cache.delete('non-existent', 'user')).not.toThrow();
		});
	});

	describe('clear', () => {
		it('should remove all tokens from cache', () => {
			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000
			};

			cache.set('account1', 'user1', token);
			cache.set('account2', 'user2', { ...token, accessToken: 'token2' });
			cache.set('account3', 'user3', { ...token, accessToken: 'token3' });

			expect(cache.size).toBe(3);

			cache.clear();
			expect(cache.size).toBe(0);
		});
	});

	describe('size', () => {
		it('should return correct size', () => {
			expect(cache.size).toBe(0);

			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000
			};

			cache.set('account1', 'user1', token);
			expect(cache.size).toBe(1);

			cache.set('account2', 'user2', { ...token, accessToken: 'token2' });
			expect(cache.size).toBe(2);
		});
	});

	describe('has', () => {
		it('should return true for existing non-expired token', () => {
			const token: CachedToken = {
				accessToken: 'test-token',
				expiresAt: Date.now() + 3600000
			};

			cache.set('myaccount', 'myuser', token);
			expect(cache.has('myaccount', 'myuser')).toBe(true);
		});

		it('should return false for non-existent key', () => {
			expect(cache.has('non-existent', 'user')).toBe(false);
		});

		it('should return false for expired token', () => {
			const token: CachedToken = {
				accessToken: 'expired-token',
				expiresAt: Date.now() + 10000 // 10 seconds (within 30s buffer)
			};

			cache.set('myaccount', 'myuser', token);
			expect(cache.has('myaccount', 'myuser')).toBe(false);
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
				expiresAt: Date.now() + 10000 // 10 seconds (within 30s buffer)
			};

			cache.set('valid', 'user', validToken);
			cache.set('expired1', 'user', expiredToken);
			cache.set('expired2', 'user', { ...expiredToken, accessToken: 'expired2' });

			expect(cache.size).toBe(3);

			cache.cleanup();

			expect(cache.size).toBe(1);
			expect(cache.has('valid', 'user')).toBe(true);
			expect(cache.has('expired1', 'user')).toBe(false);
			expect(cache.has('expired2', 'user')).toBe(false);
		});
	});
});
