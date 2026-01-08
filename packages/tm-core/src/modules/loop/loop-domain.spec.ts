/**
 * @fileoverview Unit tests for LoopDomain
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoopDomain } from './loop-domain.js';
import type { ConfigManager } from '../config/managers/config-manager.js';
import type { TasksDomain } from '../tasks/tasks-domain.js';
import type { LoopConfig } from './types.js';

// Mock ConfigManager
function createMockConfigManager(projectRoot = '/test/project'): ConfigManager {
	return {
		getProjectRoot: vi.fn().mockReturnValue(projectRoot)
	} as unknown as ConfigManager;
}

// Mock TasksDomain
function createMockTasksDomain(
	tasks: Array<{ status: string }> = []
): TasksDomain {
	return {
		list: vi.fn().mockResolvedValue({ tasks })
	} as unknown as TasksDomain;
}

describe('LoopDomain', () => {
	let mockConfigManager: ConfigManager;
	let loopDomain: LoopDomain;

	beforeEach(() => {
		mockConfigManager = createMockConfigManager();
		loopDomain = new LoopDomain(mockConfigManager);
	});

	describe('constructor', () => {
		it('should create instance with ConfigManager', () => {
			expect(loopDomain).toBeInstanceOf(LoopDomain);
		});

		it('should store projectRoot from ConfigManager', () => {
			const customManager = createMockConfigManager('/custom/root');
			const domain = new LoopDomain(customManager);
			// Verify by checking buildConfig output
			const config = (domain as any).buildConfig({});
			expect(config.progressFile).toBe(
				'/custom/root/.taskmaster/loop-progress.txt'
			);
		});

		it('should call getProjectRoot on ConfigManager', () => {
			expect(mockConfigManager.getProjectRoot).toHaveBeenCalled();
		});
	});

	describe('setTasksDomain', () => {
		it('should store TasksDomain reference', () => {
			const mockTasksDomain = createMockTasksDomain();
			loopDomain.setTasksDomain(mockTasksDomain);
			// Verify it's stored by checking checkAllTasksComplete works
			expect(
				loopDomain.checkAllTasksComplete()
			).resolves.not.toThrow();
		});
	});

	describe('buildConfig', () => {
		it('should apply default iterations of 10', () => {
			const config = (loopDomain as any).buildConfig({});
			expect(config.iterations).toBe(10);
		});

		it('should apply default prompt of "default"', () => {
			const config = (loopDomain as any).buildConfig({});
			expect(config.prompt).toBe('default');
		});

		it('should apply default sleepSeconds of 5', () => {
			const config = (loopDomain as any).buildConfig({});
			expect(config.sleepSeconds).toBe(5);
		});

		it('should apply default status of "pending"', () => {
			const config = (loopDomain as any).buildConfig({});
			expect(config.status).toBe('pending');
		});

		it('should construct progressFile from projectRoot', () => {
			const config = (loopDomain as any).buildConfig({});
			expect(config.progressFile).toBe(
				'/test/project/.taskmaster/loop-progress.txt'
			);
		});

		it('should respect provided iterations', () => {
			const config = (loopDomain as any).buildConfig({ iterations: 20 });
			expect(config.iterations).toBe(20);
		});

		it('should respect provided prompt', () => {
			const config = (loopDomain as any).buildConfig({
				prompt: 'test-coverage'
			});
			expect(config.prompt).toBe('test-coverage');
		});

		it('should respect provided sleepSeconds', () => {
			const config = (loopDomain as any).buildConfig({ sleepSeconds: 10 });
			expect(config.sleepSeconds).toBe(10);
		});

		it('should respect provided progressFile', () => {
			const config = (loopDomain as any).buildConfig({
				progressFile: '/custom/progress.txt'
			});
			expect(config.progressFile).toBe('/custom/progress.txt');
		});

		it('should respect provided tag', () => {
			const config = (loopDomain as any).buildConfig({ tag: 'my-tag' });
			expect(config.tag).toBe('my-tag');
		});

		it('should respect provided status', () => {
			const config = (loopDomain as any).buildConfig({ status: 'in-progress' });
			expect(config.status).toBe('in-progress');
		});

		it('should respect provided onComplete', () => {
			const config = (loopDomain as any).buildConfig({
				onComplete: 'echo done'
			});
			expect(config.onComplete).toBe('echo done');
		});

		it('should handle all options combined', () => {
			const fullConfig: Partial<LoopConfig> = {
				iterations: 5,
				prompt: 'linting',
				progressFile: '/my/progress.txt',
				sleepSeconds: 2,
				onComplete: 'notify-send "Done"',
				tag: 'feature-branch',
				status: 'done'
			};
			const config = (loopDomain as any).buildConfig(fullConfig);
			expect(config).toEqual(fullConfig);
		});
	});

	describe('isPreset', () => {
		it('should return true for valid preset "default"', () => {
			expect(loopDomain.isPreset('default')).toBe(true);
		});

		it('should return true for valid preset "test-coverage"', () => {
			expect(loopDomain.isPreset('test-coverage')).toBe(true);
		});

		it('should return true for valid preset "linting"', () => {
			expect(loopDomain.isPreset('linting')).toBe(true);
		});

		it('should return true for valid preset "duplication"', () => {
			expect(loopDomain.isPreset('duplication')).toBe(true);
		});

		it('should return true for valid preset "entropy"', () => {
			expect(loopDomain.isPreset('entropy')).toBe(true);
		});

		it('should return false for invalid preset', () => {
			expect(loopDomain.isPreset('invalid-preset')).toBe(false);
		});

		it('should return false for file path', () => {
			expect(loopDomain.isPreset('/path/to/prompt.md')).toBe(false);
		});

		it('should return false for empty string', () => {
			expect(loopDomain.isPreset('')).toBe(false);
		});
	});

	describe('getAvailablePresets', () => {
		it('should return array of all preset names', () => {
			const presets = loopDomain.getAvailablePresets();
			expect(presets).toEqual([
				'default',
				'test-coverage',
				'linting',
				'duplication',
				'entropy'
			]);
		});

		it('should return 5 presets', () => {
			expect(loopDomain.getAvailablePresets()).toHaveLength(5);
		});
	});

	describe('resolvePrompt', () => {
		it('should resolve preset name to content', async () => {
			const content = await loopDomain.resolvePrompt('default');
			expect(content).toContain('Task Master Loop');
			expect(content).toContain('<loop-complete>');
		});

		it('should resolve all preset names', async () => {
			const presets = loopDomain.getAvailablePresets();
			for (const preset of presets) {
				const content = await loopDomain.resolvePrompt(preset);
				expect(content).toBeTruthy();
				expect(content.length).toBeGreaterThan(0);
			}
		});

		it('should throw for custom path without readFile', async () => {
			await expect(
				loopDomain.resolvePrompt('/custom/prompt.md')
			).rejects.toThrow('no file reader provided');
		});

		it('should use readFile for custom paths', async () => {
			const mockReadFile = vi.fn().mockResolvedValue('Custom prompt content');
			const content = await loopDomain.resolvePrompt(
				'/custom/prompt.md',
				mockReadFile
			);
			expect(mockReadFile).toHaveBeenCalledWith('/custom/prompt.md');
			expect(content).toBe('Custom prompt content');
		});
	});

	describe('checkAllTasksComplete', () => {
		it('should throw error when TasksDomain not set', async () => {
			await expect(loopDomain.checkAllTasksComplete()).rejects.toThrow(
				'TasksDomain not set'
			);
		});

		it('should return true when all tasks are done', async () => {
			const mockTasksDomain = createMockTasksDomain([
				{ status: 'done' },
				{ status: 'done' },
				{ status: 'done' }
			]);
			loopDomain.setTasksDomain(mockTasksDomain);
			const result = await loopDomain.checkAllTasksComplete();
			expect(result).toBe(true);
		});

		it('should return true when all tasks are cancelled', async () => {
			const mockTasksDomain = createMockTasksDomain([
				{ status: 'cancelled' },
				{ status: 'cancelled' }
			]);
			loopDomain.setTasksDomain(mockTasksDomain);
			const result = await loopDomain.checkAllTasksComplete();
			expect(result).toBe(true);
		});

		it('should return true when tasks are mix of done and cancelled', async () => {
			const mockTasksDomain = createMockTasksDomain([
				{ status: 'done' },
				{ status: 'cancelled' },
				{ status: 'done' }
			]);
			loopDomain.setTasksDomain(mockTasksDomain);
			const result = await loopDomain.checkAllTasksComplete();
			expect(result).toBe(true);
		});

		it('should return false when any task is pending', async () => {
			const mockTasksDomain = createMockTasksDomain([
				{ status: 'done' },
				{ status: 'pending' },
				{ status: 'done' }
			]);
			loopDomain.setTasksDomain(mockTasksDomain);
			const result = await loopDomain.checkAllTasksComplete();
			expect(result).toBe(false);
		});

		it('should return false when any task is in-progress', async () => {
			const mockTasksDomain = createMockTasksDomain([
				{ status: 'done' },
				{ status: 'in-progress' }
			]);
			loopDomain.setTasksDomain(mockTasksDomain);
			const result = await loopDomain.checkAllTasksComplete();
			expect(result).toBe(false);
		});

		it('should return false when any task is blocked', async () => {
			const mockTasksDomain = createMockTasksDomain([
				{ status: 'done' },
				{ status: 'blocked' }
			]);
			loopDomain.setTasksDomain(mockTasksDomain);
			const result = await loopDomain.checkAllTasksComplete();
			expect(result).toBe(false);
		});

		it('should return true for empty task list', async () => {
			const mockTasksDomain = createMockTasksDomain([]);
			loopDomain.setTasksDomain(mockTasksDomain);
			const result = await loopDomain.checkAllTasksComplete();
			expect(result).toBe(true);
		});

		it('should pass tag option to list', async () => {
			const mockTasksDomain = createMockTasksDomain([{ status: 'done' }]);
			loopDomain.setTasksDomain(mockTasksDomain);
			await loopDomain.checkAllTasksComplete({ tag: 'my-tag' });
			expect(mockTasksDomain.list).toHaveBeenCalledWith({ tag: 'my-tag' });
		});
	});

	describe('isRunning', () => {
		it('should return false when no loop is running', () => {
			expect(loopDomain.isRunning()).toBe(false);
		});

		it('should return false after stop() when no loop was started', async () => {
			await loopDomain.stop();
			expect(loopDomain.isRunning()).toBe(false);
		});
	});

	describe('stop', () => {
		it('should not throw when called without starting a loop', async () => {
			await expect(loopDomain.stop()).resolves.not.toThrow();
		});

		it('should be callable multiple times', async () => {
			await loopDomain.stop();
			await loopDomain.stop();
			expect(loopDomain.isRunning()).toBe(false);
		});
	});
});
