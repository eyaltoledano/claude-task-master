/**
 * Simple in-memory token cache for OAuth tokens
 *
 * Caches tokens during the session to avoid repeated OAuth exchanges.
 * Tokens are refreshed automatically when they expire.
 */

import type { CachedToken } from '../types.js';

/**
 * Buffer time in milliseconds before token expiry to trigger refresh
 * Default: 30 seconds before expiry
 */
const EXPIRY_BUFFER_MS = 30 * 1000;

/**
 * Simple in-memory token cache
 */
export class TokenCache {
	private cache = new Map<string, CachedToken>();

	/**
	 * Generate a cache key for account/user combination
	 */
	private getKey(account: string, user: string): string {
		return `${account.toUpperCase()}:${user.toUpperCase()}`;
	}

	/**
	 * Check if a token is expired (with buffer)
	 */
	private isExpired(token: CachedToken): boolean {
		return token.expiresAt - EXPIRY_BUFFER_MS <= Date.now();
	}

	/**
	 * Get a cached token if it exists and is not expired
	 */
	get(account: string, user: string): CachedToken | undefined {
		const key = this.getKey(account, user);
		const token = this.cache.get(key);

		if (!token) {
			return undefined;
		}

		if (this.isExpired(token)) {
			this.cache.delete(key);
			return undefined;
		}

		return token;
	}

	/**
	 * Store a token in the cache
	 */
	set(account: string, user: string, token: CachedToken): void {
		const key = this.getKey(account, user);
		this.cache.set(key, token);
	}

	/**
	 * Remove a token from the cache
	 */
	delete(account: string, user: string): void {
		const key = this.getKey(account, user);
		this.cache.delete(key);
	}

	/**
	 * Clear all cached tokens
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Get the number of cached tokens
	 */
	get size(): number {
		return this.cache.size;
	}

	/**
	 * Check if a token exists for the given account/user
	 */
	has(account: string, user: string): boolean {
		const key = this.getKey(account, user);
		const token = this.cache.get(key);
		return token !== undefined && !this.isExpired(token);
	}

	/**
	 * Clean up expired tokens
	 */
	cleanup(): void {
		for (const [key, token] of this.cache.entries()) {
			if (this.isExpired(token)) {
				this.cache.delete(key);
			}
		}
	}
}

/**
 * Default global token cache instance
 */
export const defaultTokenCache = new TokenCache();
