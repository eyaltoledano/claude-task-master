import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TDDActivityLogger } from './tdd-activity-logger.js';

describe('TDDActivityLogger', () => {
	let logger: TDDActivityLogger;
	let mockActivityLogger: any;

	beforeEach(() => {
		mockActivityLogger = {
			logEvent: vi.fn()
		};
		logger = new TDDActivityLogger(mockActivityLogger);
	});

	describe('logPhaseTransition', () => {
		it('should log phase transition event', async () => {
			await logger.logPhaseTransition('6.1', 'RED', 'GREEN', { testCount: 5 });

			expect(mockActivityLogger.logEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'phase_transition',
					subtaskId: '6.1',
					from: 'RED',
					to: 'GREEN'
				})
			);
		});
	});

	describe('logPhaseResult', () => {
		it('should log phase result event', async () => {
			await logger.logPhaseResult('6.1', 'GREEN', true, { passCount: 10 });

			expect(mockActivityLogger.logEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'phase_result',
					subtaskId: '6.1',
					phase: 'GREEN',
					success: true
				})
			);
		});
	});
});
