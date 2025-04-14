/**
 * clear-cache.js
 * Direct function implementation for clearing the Task Master cache
 */

import { getCacheStats, clearCacheByPattern } from '../../tools/utils.js';

/**
 * Direct function wrapper for clearing Task Master cache
 *
 * @param {Object} args - Command arguments
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Result of cache clearing operation
 */
export async function clearCacheDirect(args, log) {
	try {
		log.info('Starting cache clearing operation');
		
		// Get stats before clearing for reporting
		const beforeStats = getCacheStats();
		const initialCacheSize = beforeStats.size;
		
		log.info(`Initial cache size: ${initialCacheSize} entries`);
		
		if (initialCacheSize === 0) {
			log.info('Cache is already empty, nothing to clear');
			return {
				success: true,
				data: {
					message: 'Cache is already empty, nothing to clear',
					clearedEntries: 0,
					pattern: args.pattern || 'all'
				},
				fromCache: false
			};
		}
		
		// If a specific pattern is provided, only clear those entries
		let clearedEntries = 0;
		if (args.pattern) {
			log.info(`Clearing cache entries matching pattern: ${args.pattern}`);
			clearedEntries = clearCacheByPattern(args.pattern, log);
		} else {
			// Clear all entries if no pattern specified
			log.info('Clearing all cache entries');
			
			// Use the clearCacheByPattern with an empty string to match all keys
			clearedEntries = clearCacheByPattern('', log);
			
			// Double-check that everything was cleared
			if (global.taskMasterCache.size > 0) {
				log.info('Some entries remained, forcing complete cache clear');
				global.taskMasterCache.clear();
				clearedEntries = initialCacheSize;
			}
		}
		
		// Get final stats
		const afterStats = getCacheStats();
		
		return {
			success: true,
			data: {
				message: `Successfully cleared ${clearedEntries} cache entries`,
				clearedEntries,
				beforeSize: initialCacheSize,
				afterSize: afterStats.size,
				pattern: args.pattern || 'all'
			},
			fromCache: false
		};
	} catch (error) {
		log.error(`Error clearing cache: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CACHE_CLEAR_ERROR',
				message: error.message || 'Unknown error clearing cache'
			},
			fromCache: false
		};
	}
} 