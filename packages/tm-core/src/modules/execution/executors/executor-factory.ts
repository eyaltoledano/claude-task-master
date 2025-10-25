/**
 * Factory for creating task executors
 */

import type { ITaskExecutor, ExecutorOptions, ExecutorType } from '../types.js';
import { ClaudeExecutor } from '../executors/claude-executor.js';
import { getLogger } from '../../../common/logger/index.js';

export class ExecutorFactory {
	private static logger = getLogger('ExecutorFactory');

	/**
	 * Create an executor based on the provided options
	 */
	static create(options: ExecutorOptions): ITaskExecutor {
		this.logger.debug(`Creating executor of type: ${options.type}`);

		switch (options.type) {
			case 'claude':
				return new ClaudeExecutor(options.projectRoot, options.config);

			case 'shell':
				// Placeholder for shell executor
				throw new Error('Shell executor not yet implemented');

			case 'custom':
				// Placeholder for custom executor
				throw new Error('Custom executor not yet implemented');

			default:
				throw new Error(`Unknown executor type: ${options.type}`);
		}
	}

	/**
	 * Get the default executor type based on available tools
	 */
	static async getDefaultExecutor(
		projectRoot: string
	): Promise<ExecutorType | null> {
		// Check for Claude first
		const claudeExecutor = new ClaudeExecutor(projectRoot);
		if (await claudeExecutor.isAvailable()) {
			this.logger.info('Claude CLI detected as default executor');
			return 'claude';
		}

		// Could check for other executors here
		this.logger.warn('No default executor available');
		return null;
	}

	/**
	 * Get list of available executor types
	 */
	static getAvailableTypes(): ExecutorType[] {
		return ['claude', 'shell', 'custom'];
	}
}
