/**
 * @fileoverview Integration tests for loop type exports from @tm/core
 *
 * Verifies that all loop types and the LoopDomain class are correctly
 * exported from the main @tm/core index.ts entry point.
 *
 * @integration
 */

import { describe, expect, it } from 'vitest';

// Import types and class from @tm/core main entry point
import {
	LoopDomain,
	type LoopPreset,
	type LoopConfig,
	type LoopIteration,
	type LoopResult
} from '../../../src/index.js';
import type { ConfigManager } from '../../../src/modules/config/managers/config-manager.js';

// Helper to create mock ConfigManager
function createMockConfigManager(projectRoot = '/test/project'): ConfigManager {
	return {
		getProjectRoot: () => projectRoot
	} as unknown as ConfigManager;
}

describe('Loop Exports from @tm/core', () => {
	describe('LoopDomain Class Export', () => {
		it('should export LoopDomain class', () => {
			expect(LoopDomain).toBeDefined();
			expect(typeof LoopDomain).toBe('function');
		});

		it('should be constructible', () => {
			const mockConfigManager = createMockConfigManager();
			const domain = new LoopDomain(mockConfigManager);
			expect(domain).toBeInstanceOf(LoopDomain);
		});
	});

	describe('Loop Type Exports', () => {
		it('should export LoopPreset type (compile-time verification)', () => {
			// TypeScript compilation verifies these types exist
			const preset: LoopPreset = 'default';
			expect(preset).toBe('default');

			// Verify all valid presets
			const validPresets: LoopPreset[] = [
				'default',
				'test-coverage',
				'linting',
				'duplication',
				'entropy'
			];
			expect(validPresets).toHaveLength(5);
		});

		it('should export LoopConfig type (compile-time verification)', () => {
			const config: LoopConfig = {
				iterations: 10,
				prompt: 'default',
				sleepSeconds: 5,
				progressFile: '/path/to/progress.txt'
			};
			expect(config.iterations).toBe(10);
			expect(config.prompt).toBe('default');
			expect(config.sleepSeconds).toBe(5);
			expect(config.progressFile).toBe('/path/to/progress.txt');
		});

		it('should export LoopConfig type with optional fields', () => {
			const configWithTag: LoopConfig = {
				iterations: 5,
				prompt: '/custom/prompt.md',
				sleepSeconds: 10,
				progressFile: '/progress.txt',
				tag: 'feature-branch'
			};
			expect(configWithTag.tag).toBe('feature-branch');
		});

		it('should export LoopIteration type (compile-time verification)', () => {
			const iteration: LoopIteration = {
				iteration: 1,
				status: 'success',
				taskId: 'task-1',
				message: 'Task completed successfully',
				duration: 1000
			};
			expect(iteration.iteration).toBe(1);
			expect(iteration.status).toBe('success');
			expect(iteration.taskId).toBe('task-1');
		});

		it('should export LoopIteration with all status values', () => {
			const statuses: LoopIteration['status'][] = [
				'success',
				'complete',
				'blocked',
				'error'
			];
			expect(statuses).toContain('success');
			expect(statuses).toContain('complete');
			expect(statuses).toContain('blocked');
			expect(statuses).toContain('error');
		});

		it('should export LoopResult type (compile-time verification)', () => {
			const result: LoopResult = {
				totalIterations: 3,
				tasksCompleted: 5,
				finalStatus: 'all_complete',
				iterations: []
			};
			expect(result.totalIterations).toBe(3);
			expect(result.finalStatus).toBe('all_complete');
			expect(result.tasksCompleted).toBe(5);
		});

		it('should export LoopResult with all finalStatus values', () => {
			const finalStatuses: LoopResult['finalStatus'][] = [
				'all_complete',
				'max_iterations',
				'blocked',
				'error'
			];
			expect(finalStatuses).toContain('all_complete');
			expect(finalStatuses).toContain('max_iterations');
			expect(finalStatuses).toContain('blocked');
			expect(finalStatuses).toContain('error');
		});
	});

	describe('Export Usability', () => {
		it('should support typical import patterns', () => {
			// This test verifies that the imports at the top of this file work
			// If the imports fail, this test file won't even compile
			expect(true).toBe(true);
		});

		it('should allow creating LoopDomain with valid config access', () => {
			const mockConfigManager = createMockConfigManager();
			const domain = new LoopDomain(mockConfigManager);

			// Verify domain has expected methods
			expect(typeof domain.isPreset).toBe('function');
			expect(typeof domain.resolvePrompt).toBe('function');
			expect(typeof domain.getAvailablePresets).toBe('function');
			expect(typeof domain.getIsRunning).toBe('function');
			expect(typeof domain.stop).toBe('function');
		});
	});
});
