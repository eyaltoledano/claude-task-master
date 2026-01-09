/**
 * @fileoverview Tests for loop module type definitions
 */

import { describe, it, expect } from 'vitest';
import type {
	LoopPreset,
	LoopConfig,
	LoopIteration,
	LoopResult
} from './types.js';

// Also verify types are exported from the barrel
import type {
	LoopPreset as BarrelLoopPreset,
	LoopConfig as BarrelLoopConfig,
	LoopIteration as BarrelLoopIteration,
	LoopResult as BarrelLoopResult
} from './index.js';

describe('Loop Types', () => {
	describe('LoopPreset', () => {
		it('accepts valid preset values', () => {
			// TypeScript compile-time check - these should all be valid
			const presets: LoopPreset[] = [
				'default',
				'test-coverage',
				'linting',
				'duplication',
				'entropy'
			];
			expect(presets).toHaveLength(5);
		});
	});

	describe('LoopConfig', () => {
		it('accepts valid config with required fields', () => {
			const config: LoopConfig = {
				iterations: 10,
				prompt: 'default',
				progressFile: '/path/to/progress.txt',
				sleepSeconds: 5
			};
			expect(config.iterations).toBe(10);
			expect(config.prompt).toBe('default');
			expect(config.progressFile).toBe('/path/to/progress.txt');
			expect(config.sleepSeconds).toBe(5);
		});

		it('accepts config with all optional fields', () => {
			const config: LoopConfig = {
				iterations: 5,
				prompt: 'test-coverage',
				progressFile: '/progress.txt',
				sleepSeconds: 3,
				tag: 'feature-branch'
			};
			expect(config.tag).toBe('feature-branch');
		});

		it('accepts custom prompt string', () => {
			const config: LoopConfig = {
				iterations: 1,
				prompt: '/path/to/custom-prompt.txt',
				progressFile: '/progress.txt',
				sleepSeconds: 0
			};
			expect(config.prompt).toBe('/path/to/custom-prompt.txt');
		});
	});

	describe('LoopIteration', () => {
		it('accepts valid iteration with minimal fields', () => {
			const iteration: LoopIteration = {
				iteration: 1,
				status: 'success'
			};
			expect(iteration.iteration).toBe(1);
			expect(iteration.status).toBe('success');
		});

		it('accepts iteration with all fields', () => {
			const iteration: LoopIteration = {
				iteration: 3,
				taskId: '1.2',
				status: 'blocked',
				message: 'Waiting on external API',
				duration: 45000
			};
			expect(iteration.taskId).toBe('1.2');
			expect(iteration.message).toBe('Waiting on external API');
			expect(iteration.duration).toBe(45000);
		});

		it('accepts all status values', () => {
			const statuses: LoopIteration['status'][] = [
				'success',
				'blocked',
				'error',
				'complete'
			];
			expect(statuses).toHaveLength(4);
		});
	});

	describe('LoopResult', () => {
		it('accepts valid loop result', () => {
			const result: LoopResult = {
				iterations: [
					{ iteration: 1, status: 'success', taskId: '1' },
					{ iteration: 2, status: 'success', taskId: '2' }
				],
				totalIterations: 2,
				tasksCompleted: 2,
				finalStatus: 'all_complete'
			};
			expect(result.iterations).toHaveLength(2);
			expect(result.totalIterations).toBe(2);
			expect(result.tasksCompleted).toBe(2);
			expect(result.finalStatus).toBe('all_complete');
		});

		it('accepts all final status values', () => {
			const statuses: LoopResult['finalStatus'][] = [
				'all_complete',
				'max_iterations',
				'blocked',
				'error'
			];
			expect(statuses).toHaveLength(4);
		});
	});

	describe('Barrel exports from index.ts', () => {
		it('exports all types from barrel', () => {
			// Verify types are accessible from barrel export
			const preset: BarrelLoopPreset = 'default';
			const config: BarrelLoopConfig = {
				iterations: 5,
				prompt: preset,
				progressFile: '/progress.txt',
				sleepSeconds: 2
			};
			const iteration: BarrelLoopIteration = {
				iteration: 1,
				status: 'success'
			};
			const result: BarrelLoopResult = {
				iterations: [iteration],
				totalIterations: 1,
				tasksCompleted: 1,
				finalStatus: 'all_complete'
			};

			expect(config.prompt).toBe('default');
			expect(result.iterations).toHaveLength(1);
		});
	});
});
