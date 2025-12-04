/**
 * Token cache with support for persistent storage via Snowflake's credential manager
 *
 * Uses the JsonCredentialManager from snowflake-sdk for persistent file-based caching
 * with fallback to in-memory caching if unavailable.
 *
 * Cache locations (platform-specific):
 * - Windows: %LOCALAPPDATA%\Snowflake\Caches\credential_cache_v1.json
 * - macOS: ~/Library/Caches/Snowflake/credential_cache_v1.json
 * - Linux: ~/.cache/snowflake/credential_cache_v1.json
 *
 * Uses the same key format as other Snowflake tools for compatibility.
 * See: https://github.com/snowflakedb/snowflake-connector-nodejs/blob/master/lib/authentication/authentication_util.js
 */

import type { CachedToken } from '../types.js';

/**
 * Buffer time in milliseconds before token expiry to trigger refresh
 * Default: 30 seconds before expiry
 */
const EXPIRY_BUFFER_MS = 30 * 1000;

/**
 * Token type identifier for cache keys (compatible with Snowflake SDK format)
 */
const TOKEN_TYPE = 'tm_ai_sdk_access_token';

/**
 * Interface for the Snowflake JsonCredentialManager
 * This is an internal API from snowflake-sdk
 */
interface JsonCredentialManager {
	write(key: string, token: string): Promise<void>;
	read(key: string): Promise<string | null>;
	remove(key: string): Promise<void>;
	hashKey(key: string): string;
}

/**
 * Function to build cache keys in Snowflake-compatible format
 * Format: {HOST}:{USER}:{TOKEN_TYPE}
 */
type BuildCredentialCacheKey = (
	host: string,
	user: string,
	tokenType: string
) => string;

/**
 * Try to import utilities from snowflake-sdk
 */
let SnowflakeCredentialManager:
	| (new (
			credentialCacheDir?: string,
			timeoutMs?: number
	  ) => JsonCredentialManager)
	| null = null;
let buildCredentialCacheKey: BuildCredentialCacheKey | null = null;

try {
	// Import JsonCredentialManager
	// Note: This is not a public API and may change in future versions
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const credModule = require('snowflake-sdk/dist/lib/authentication/secure_storage/json_credential_manager');
	SnowflakeCredentialManager = credModule.JsonCredentialManager;

	// Import buildCredentialCacheKey for compatible key format
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const utilModule = require('snowflake-sdk/dist/lib/util');
	buildCredentialCacheKey = utilModule.buildCredentialCacheKey;
} catch {
	// Snowflake SDK internals not available, will use in-memory only with custom key format
}

/**
 * Token cache that uses Snowflake's credential manager for persistent storage
 * with fallback to in-memory caching
 */
export class TokenCache {
	private inMemoryCache: Map<string, CachedToken>;
	private credentialManager: JsonCredentialManager | null = null;
	private persistEnabled: boolean;

	/**
	 * Create a new token cache
	 * @param enablePersistence Enable persistent file-based caching (default: true)
	 * @param credentialCacheDir Custom directory for credential cache
	 */
	constructor(enablePersistence: boolean = true, credentialCacheDir?: string) {
		this.inMemoryCache = new Map();
		this.persistEnabled = enablePersistence;

		if (enablePersistence && SnowflakeCredentialManager) {
			try {
				this.credentialManager = new SnowflakeCredentialManager(
					credentialCacheDir
				);
			} catch {
				// Failed to initialize credential manager, use in-memory only
				this.credentialManager = null;
			}
		}
	}

	/**
	 * Generate a cache key for a token
	 * Uses Snowflake SDK's key format if available for compatibility with other tools
	 * Format: {ACCOUNT}:{USER}:{TOKEN_TYPE}
	 *
	 * @param account Snowflake account identifier
	 * @param user Username
	 */
	private getCacheKey(account: string, user: string): string {
		if (buildCredentialCacheKey) {
			// Use Snowflake SDK's key format for compatibility
			// This creates keys like: {MYACCOUNT.SNOWFLAKECOMPUTING.COM}:{MYUSER}:{TM_AI_SDK_ACCESS_TOKEN}
			const host = account.includes('.')
				? account
				: `${account}.snowflakecomputing.com`;
			return buildCredentialCacheKey(host, user, TOKEN_TYPE);
		}
		// Fallback to simple format if SDK utility not available
		return `{${account.toUpperCase()}}:{${user.toUpperCase()}}:{${TOKEN_TYPE.toUpperCase()}}`;
	}

	/**
	 * Check if a token is expired (with buffer)
	 */
	private isExpired(token: CachedToken): boolean {
		return token.expiresAt - EXPIRY_BUFFER_MS <= Date.now();
	}

	/**
	 * Serialize a token for persistent storage
	 */
	private serializeToken(token: CachedToken): string {
		return JSON.stringify({
			accessToken: token.accessToken,
			expiresAt: token.expiresAt,
			baseURL: token.baseURL
		});
	}

	/**
	 * Deserialize a token from persistent storage
	 */
	private deserializeToken(data: string): CachedToken | null {
		try {
			const parsed = JSON.parse(data);
			if (parsed.accessToken && parsed.expiresAt) {
				return {
					accessToken: parsed.accessToken,
					expiresAt: parsed.expiresAt,
					baseURL: parsed.baseURL
				};
			}
		} catch {
			// Invalid token data
		}
		return null;
	}

	/**
	 * Get a cached token if it exists and is not expired
	 * @param account Snowflake account identifier
	 * @param user Username
	 * @returns Cached token or undefined if expired/not found
	 */
	async get(account: string, user: string): Promise<CachedToken | undefined> {
		const key = this.getCacheKey(account, user);

		// First check in-memory cache
		const memCached = this.inMemoryCache.get(key);
		if (memCached && !this.isExpired(memCached)) {
			return memCached;
		}

		// Remove expired in-memory token
		if (memCached) {
			this.inMemoryCache.delete(key);
		}

		// Check persistent cache if available
		if (this.credentialManager) {
			try {
				const stored = await this.credentialManager.read(key);
				if (stored) {
					const token = this.deserializeToken(stored);
					if (token && !this.isExpired(token)) {
						// Store in memory for faster subsequent access
						this.inMemoryCache.set(key, token);
						return token;
					} else if (token) {
						// Remove expired persistent token
						await this.credentialManager.remove(key);
					}
				}
			} catch {
				// Error reading from persistent cache, continue with in-memory only
			}
		}

		return undefined;
	}

	/**
	 * Store a token in the cache
	 * @param account Snowflake account identifier
	 * @param user Username
	 * @param token Token to cache
	 */
	async set(account: string, user: string, token: CachedToken): Promise<void> {
		const key = this.getCacheKey(account, user);

		// Store in memory
		this.inMemoryCache.set(key, token);

		// Store in persistent cache if available
		if (this.credentialManager && this.persistEnabled) {
			try {
				await this.credentialManager.write(key, this.serializeToken(token));
			} catch {
				// Failed to persist token, in-memory cache still works
			}
		}
	}

	/**
	 * Remove a token from the cache
	 * @param account Snowflake account identifier
	 * @param user Username
	 */
	async delete(account: string, user: string): Promise<void> {
		const key = this.getCacheKey(account, user);

		// Remove from memory
		this.inMemoryCache.delete(key);

		// Remove from persistent cache if available
		if (this.credentialManager) {
			try {
				await this.credentialManager.remove(key);
			} catch {
				// Failed to remove from persistent cache
			}
		}
	}

	/**
	 * Clear all cached tokens (in-memory only - does not clear persistent cache)
	 */
	clear(): void {
		this.inMemoryCache.clear();
	}

	/**
	 * Get the number of in-memory cached tokens
	 */
	get size(): number {
		return this.inMemoryCache.size;
	}

	/**
	 * Check if persistent caching is enabled and available
	 */
	get isPersistentCacheAvailable(): boolean {
		return this.credentialManager !== null;
	}

	/**
	 * Legacy sync get method for backward compatibility
	 * Only checks in-memory cache
	 * @deprecated Use async get() method instead
	 */
	getSync(key: string): CachedToken | undefined {
		const cached = this.inMemoryCache.get(key);

		if (!cached) {
			return undefined;
		}

		if (this.isExpired(cached)) {
			this.inMemoryCache.delete(key);
			return undefined;
		}

		return cached;
	}

	/**
	 * Legacy sync set method for backward compatibility
	 * Only stores in in-memory cache
	 * @deprecated Use async set() method instead
	 */
	setSync(key: string, token: CachedToken): void {
		this.inMemoryCache.set(key, token);
	}

	/**
	 * Legacy sync has method for backward compatibility
	 */
	has(key: string): boolean {
		return this.inMemoryCache.has(key);
	}

	/**
	 * Clean up expired tokens from in-memory cache
	 */
	cleanup(): void {
		for (const [key, token] of Array.from(this.inMemoryCache.entries())) {
			if (this.isExpired(token)) {
				this.inMemoryCache.delete(key);
			}
		}
	}
}

/**
 * Default global token cache instance with persistence enabled
 */
export const defaultTokenCache = new TokenCache(true);
