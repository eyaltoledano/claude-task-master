/**
 * Polling Strategies - Simplified
 * Different algorithms for polling intervals
 */

import type { PollingStrategy } from './polling-service';

/**
 * Fixed interval polling
 */
export class FixedIntervalStrategy implements PollingStrategy {
	constructor(private interval = 10000) {}

	calculateNextInterval(): number {
		return this.interval;
	}

	getName(): string {
		return 'fixed';
	}
}

/**
 * Adaptive polling based on activity
 */
export class AdaptivePollingStrategy implements PollingStrategy {
	private readonly MIN_INTERVAL = 5000; // 5 seconds
	private readonly MAX_INTERVAL = 60000; // 1 minute
	private readonly BASE_INTERVAL = 10000; // 10 seconds

	calculateNextInterval(consecutiveNoChanges: number): number {
		// Start with base interval
		let interval = this.BASE_INTERVAL;

		// If no changes for a while, slow down
		if (consecutiveNoChanges > 5) {
			interval = Math.min(
				this.MAX_INTERVAL,
				this.BASE_INTERVAL * 1.5 ** (consecutiveNoChanges - 5)
			);
		} else if (consecutiveNoChanges === 0) {
			// Recent change, poll more frequently
			interval = this.MIN_INTERVAL;
		}

		return Math.round(interval);
	}

	getName(): string {
		return 'adaptive';
	}
}

/**
 * Create polling strategy from configuration
 */
export function createPollingStrategy(config: any): PollingStrategy {
	const type = config.get('polling.strategy', 'adaptive');
	const interval = config.get('polling.interval', 10000);

	switch (type) {
		case 'fixed':
			return new FixedIntervalStrategy(interval);
		default:
			return new AdaptivePollingStrategy();
	}
}
