/**
 * cache-stats.js
 * Direct function implementation for retrieving cache statistics
 */

import { contextManager } from '../context-manager.js';

/**
 * Get cache statistics for monitoring
 * @param {Object} args - Command arguments
 * @param {Object} log - Logger object
 * @returns {Object} - Cache statistics
 */
export async function getCacheStatsDirect(args, log) {
	try {
		log.info('Retrieving cache statistics');
		const stats = contextManager.getStats();
		return {
			success: true,
			data: stats
		};
	} catch (error) {
		log.error(`Error getting cache stats: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CACHE_STATS_ERROR',
				message: error.message || 'Unknown error occurred'
			}
		};
	}
}
