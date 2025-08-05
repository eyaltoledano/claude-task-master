/**
 * Polling Service - Simplified version
 * Uses strategy pattern for different polling behaviors
 */

import type { ExtensionLogger } from '../utils/logger';
import type { TaskRepository } from './task-repository';

export interface PollingStrategy {
	calculateNextInterval(
		consecutiveNoChanges: number,
		lastChangeTime?: number
	): number;
	getName(): string;
}

export class PollingService {
	private timer?: NodeJS.Timeout;
	private consecutiveNoChanges = 0;
	private lastChangeTime?: number;
	private lastTasksJson?: string;

	constructor(
		private repository: TaskRepository,
		private strategy: PollingStrategy,
		private logger: ExtensionLogger
	) {}

	start(): void {
		if (this.timer) {
			return;
		}

		this.logger.log(
			`Starting polling with ${this.strategy.getName()} strategy`
		);
		this.scheduleNextPoll();
	}

	stop(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
			this.logger.log('Polling stopped');
		}
	}

	setStrategy(strategy: PollingStrategy): void {
		this.strategy = strategy;
		this.logger.log(`Changed to ${strategy.getName()} polling strategy`);

		// Restart with new strategy if running
		if (this.timer) {
			this.stop();
			this.start();
		}
	}

	private async poll(): Promise<void> {
		try {
			const tasks = await this.repository.getAll();
			const tasksJson = JSON.stringify(tasks);

			// Check for changes
			if (tasksJson !== this.lastTasksJson) {
				this.consecutiveNoChanges = 0;
				this.lastChangeTime = Date.now();
				this.logger.debug('Tasks changed');
			} else {
				this.consecutiveNoChanges++;
			}

			this.lastTasksJson = tasksJson;
		} catch (error) {
			this.logger.error('Polling error', error);
		}
	}

	private scheduleNextPoll(): void {
		const interval = this.strategy.calculateNextInterval(
			this.consecutiveNoChanges,
			this.lastChangeTime
		);

		this.timer = setTimeout(async () => {
			await this.poll();
			this.scheduleNextPoll();
		}, interval);

		this.logger.debug(`Next poll in ${interval}ms`);
	}
}
