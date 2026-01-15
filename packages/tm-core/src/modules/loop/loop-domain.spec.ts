/**
 * @fileoverview Unit tests for LoopDomain
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoopDomain } from './loop-domain.js';
import type { ConfigManager } from '../config/managers/config-manager.js';
import type { LoopConfig } from './types.js';

// Mock ConfigManager
function createMockConfigManager(projectRoot = '/test/project'): ConfigManager {
	return {
		getProjectRoot: vi.fn().mockReturnValue(projectRoot)
	} as unknown as ConfigManager;
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
			expect(config.progressFile).toBe('/custom/root/.taskmaster/progress.txt');
		});

		it('should call getProjectRoot on ConfigManager', () => {
			expect(mockConfigManager.getProjectRoot).toHaveBeenCalled();
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

		it('should construct progressFile from projectRoot', () => {
			const config = (loopDomain as any).buildConfig({});
			expect(config.progressFile).toBe(
				'/test/project/.taskmaster/progress.txt'
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

		it('should handle all options combined', () => {
			const fullConfig: Partial<LoopConfig> = {
				iterations: 5,
				prompt: 'linting',
				progressFile: '/my/progress.txt',
				sleepSeconds: 2,
				tag: 'feature-branch'
			};
			const config = (loopDomain as any).buildConfig(fullConfig);
			expect(config).toMatchObject(fullConfig);
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
			expect(presets).toHaveLength(5);
			expect(presets).toEqual(
				expect.arrayContaining([
					'default',
					'test-coverage',
					'linting',
					'duplication',
					'entropy'
				])
			);
		});
	});

	describe('resolvePrompt', () => {
		it('should resolve preset name to content', async () => {
			const content = await loopDomain.resolvePrompt('default');
			expect(typeof content).toBe('string');
			expect(content.length).toBeGreaterThan(0);
			// Assert on structural property - all presets should contain completion marker
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
			).rejects.toThrow('readFile callback');
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

	describe('getIsRunning', () => {
		it('should return false when no loop is running', () => {
			expect(loopDomain.getIsRunning()).toBe(false);
		});

		it('should return false after stop() when no loop was started', () => {
			loopDomain.stop();
			expect(loopDomain.getIsRunning()).toBe(false);
		});
	});

	describe('stop', () => {
		it('should not throw when called without starting a loop', () => {
			expect(() => loopDomain.stop()).not.toThrow();
		});

		it('should be callable multiple times', () => {
			loopDomain.stop();
			loopDomain.stop();
			expect(loopDomain.getIsRunning()).toBe(false);
		});
	});

	describe('resolveIterations', () => {
		it('should return userIterations when provided', () => {
			const result = loopDomain.resolveIterations({
				userIterations: 25,
				preset: 'default',
				pendingTaskCount: 10
			});
			expect(result).toBe(25);
		});

		it('should return pendingTaskCount for default preset when no userIterations', () => {
			const result = loopDomain.resolveIterations({
				preset: 'default',
				pendingTaskCount: 15
			});
			expect(result).toBe(15);
		});

		it('should return 10 for default preset when pendingTaskCount is 0', () => {
			const result = loopDomain.resolveIterations({
				preset: 'default',
				pendingTaskCount: 0
			});
			expect(result).toBe(10);
		});

		it('should return 10 for default preset when pendingTaskCount is undefined', () => {
			const result = loopDomain.resolveIterations({
				preset: 'default'
			});
			expect(result).toBe(10);
		});

		it('should return 10 for non-default presets regardless of pendingTaskCount', () => {
			const presets = ['test-coverage', 'linting', 'duplication', 'entropy'];
			for (const preset of presets) {
				const result = loopDomain.resolveIterations({
					preset,
					pendingTaskCount: 50
				});
				expect(result).toBe(10);
			}
		});

		it('should prioritize userIterations over pendingTaskCount for default preset', () => {
			const result = loopDomain.resolveIterations({
				userIterations: 5,
				preset: 'default',
				pendingTaskCount: 100
			});
			expect(result).toBe(5);
		});

		it('should prioritize userIterations for non-default presets', () => {
			const result = loopDomain.resolveIterations({
				userIterations: 30,
				preset: 'linting'
			});
			expect(result).toBe(30);
		});
	});
});
