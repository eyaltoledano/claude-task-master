/**
 * Cache Manager
 * Handles all caching logic with LRU eviction and analytics
 */

import type { ExtensionLogger } from '../../logger';
import type { CacheAnalytics, CacheConfig, CacheEntry } from '../types';

export class CacheManager {
	private cache = new Map<string, CacheEntry>();
	private analytics: CacheAnalytics = {
		hits: 0,
		misses: 0,
		evictions: 0,
		refreshes: 0,
		totalSize: 0,
		averageAccessTime: 0,
		hitRate: 0
	};
	private backgroundRefreshTimer?: NodeJS.Timeout;

	constructor(
		private config: CacheConfig & { cacheDuration: number },
		private logger: ExtensionLogger
	) {
		if (config.enableBackgroundRefresh) {
			this.initializeBackgroundRefresh();
		}
	}

	/**
	 * Get data from cache if not expired
	 */
	get(key: string): any {
		const startTime = Date.now();
		const cached = this.cache.get(key);

		if (cached) {
			const isExpired =
				Date.now() - cached.timestamp >=
				(cached.ttl || this.config.cacheDuration);

			if (!isExpired) {
				// Update access statistics
				cached.accessCount++;
				cached.lastAccessed = Date.now();

				if (this.config.enableAnalytics) {
					this.analytics.hits++;
				}

				const accessTime = Date.now() - startTime;
				this.logger.debug(
					`Cache hit for ${key} (${accessTime}ms, ${cached.accessCount} accesses)`
				);
				return cached.data;
			} else {
				// Remove expired entry
				this.cache.delete(key);
				this.logger.debug(`Cache entry expired and removed: ${key}`);
			}
		}

		if (this.config.enableAnalytics) {
			this.analytics.misses++;
		}

		this.logger.debug(`Cache miss for ${key}`);
		return null;
	}

	/**
	 * Set data in cache with LRU eviction
	 */
	set(
		key: string,
		data: any,
		options?: { ttl?: number; tags?: string[] }
	): void {
		const now = Date.now();
		const dataSize = this.estimateDataSize(data);

		// Create cache entry
		const entry: CacheEntry = {
			data,
			timestamp: now,
			accessCount: 1,
			lastAccessed: now,
			size: dataSize,
			ttl: options?.ttl,
			tags: options?.tags || [key.split('_')[0]]
		};

		// Check if we need to evict entries (LRU strategy)
		if (this.cache.size >= this.config.maxSize) {
			this.evictLRUEntries(Math.max(1, Math.floor(this.config.maxSize * 0.1)));
		}

		this.cache.set(key, entry);
		this.logger.debug(
			`Cached data for ${key} (size: ${dataSize} bytes, TTL: ${entry.ttl || this.config.cacheDuration}ms)`
		);

		// Trigger prefetch if enabled
		if (this.config.enablePrefetch) {
			this.scheduleRelatedDataPrefetch(key, data);
		}
	}

	/**
	 * Clear cache entries matching a pattern
	 */
	clearPattern(pattern: string): void {
		let evictedCount = 0;
		for (const key of this.cache.keys()) {
			if (key.includes(pattern)) {
				this.cache.delete(key);
				evictedCount++;
			}
		}

		if (evictedCount > 0) {
			this.analytics.evictions += evictedCount;
			this.logger.debug(
				`Evicted ${evictedCount} cache entries matching pattern: ${pattern}`
			);
		}
	}

	/**
	 * Clear all cached data
	 */
	clear(): void {
		this.cache.clear();
		this.resetAnalytics();
	}

	/**
	 * Get cache analytics
	 */
	getAnalytics(): CacheAnalytics {
		this.updateAnalytics();
		return { ...this.analytics };
	}

	/**
	 * Get frequently accessed entries for background refresh
	 */
	getRefreshCandidates(): Array<[string, CacheEntry]> {
		return Array.from(this.cache.entries())
			.filter(([key, entry]) => {
				const age = Date.now() - entry.timestamp;
				const isNearExpiration = age > this.config.cacheDuration * 0.7;
				const isFrequentlyAccessed = entry.accessCount >= 3;
				return (
					isNearExpiration && isFrequentlyAccessed && key.includes('get_tasks')
				);
			})
			.sort((a, b) => b[1].accessCount - a[1].accessCount)
			.slice(0, 5);
	}

	/**
	 * Update refresh count for analytics
	 */
	incrementRefreshes(): void {
		this.analytics.refreshes++;
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		if (this.backgroundRefreshTimer) {
			clearInterval(this.backgroundRefreshTimer);
			this.backgroundRefreshTimer = undefined;
		}
		this.clear();
	}

	private initializeBackgroundRefresh(): void {
		if (this.backgroundRefreshTimer) {
			clearInterval(this.backgroundRefreshTimer);
		}

		const interval = this.config.refreshInterval;
		this.backgroundRefreshTimer = setInterval(() => {
			// Background refresh is handled by the main API class
			// This just maintains the timer
		}, interval);

		this.logger.debug(
			`Cache background refresh initialized with ${interval}ms interval`
		);
	}

	private evictLRUEntries(count: number): void {
		const entries = Array.from(this.cache.entries())
			.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
			.slice(0, count);

		for (const [key] of entries) {
			this.cache.delete(key);
			this.analytics.evictions++;
		}

		if (entries.length > 0) {
			this.logger.debug(`Evicted ${entries.length} LRU cache entries`);
		}
	}

	private estimateDataSize(data: any): number {
		try {
			return JSON.stringify(data).length * 2; // Rough estimate
		} catch {
			return 1000; // Default fallback
		}
	}

	private scheduleRelatedDataPrefetch(key: string, data: any): void {
		if (key.includes('get_tasks') && Array.isArray(data)) {
			this.logger.debug(
				`Scheduled prefetch for ${data.length} tasks related to ${key}`
			);
		}
	}

	private resetAnalytics(): void {
		this.analytics = {
			hits: 0,
			misses: 0,
			evictions: 0,
			refreshes: 0,
			totalSize: 0,
			averageAccessTime: 0,
			hitRate: 0
		};
	}

	private updateAnalytics(): void {
		const total = this.analytics.hits + this.analytics.misses;
		this.analytics.hitRate = total > 0 ? this.analytics.hits / total : 0;
		this.analytics.totalSize = this.cache.size;

		if (this.cache.size > 0) {
			const totalAccessTime = Array.from(this.cache.values()).reduce(
				(sum, entry) => sum + (entry.lastAccessed - entry.timestamp),
				0
			);
			this.analytics.averageAccessTime = totalAccessTime / this.cache.size;
		}
	}
}
